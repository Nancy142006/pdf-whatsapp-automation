const fs = require("fs-extra");
const path = require("path");
const csv = require("csv-parser");
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");
const express = require("express");
const multer = require("multer");
const request = require("request");
const axios = require("axios");

const app = express();
const upload = multer({dest: "temp/"});

const inputCSV = "data1.csv";
const templatePDF = "template.pdf";
const outputFolder = "generated_pdfs";

fs.ensureDirSync(outputFolder);

// upload endpoint
app.post('/upload', upload.single('file'), (req, res) => {
  let response = '';
  try {
    fs.readFile('temp/' + req.file.filename, function (err, data) {
      if (err) return console.error(err);

      options = {
        url: 'https://whatsapp.turn.io/v1/media',
        body: data,
        headers: {
          'Authorization': `Bearer {token} `,
          'Content-Type': "application/pdf"
        }
      }

      request.post(options, function (err, message, data) {
        if (err) return console.error(err);

        data = JSON.parse(data);
        try {
          return res.status(200).json({media_id: data.media[0].id});
        }  catch(err) {
          return res.status(400).json({message: "Media ID could not be created. Please check the file again and upload"});
        }

      });
    });

  } catch(err) {
    console.error(err);
    return res.status(400).json({message: "Invalid Request"});
  }
})

//Whatsapp messaging function
async function sendMessage(phoneNumber, message) {
  const url = "https://whatsapp.turn.io/v1/messages";
  const token = TURN_TOKEN;
  const data = {
    to: phoneNumber,
    type: "template",
    template: {
      namespace: "b28cb7ce_ecd8_416e_a389_ed0371d0b19a",
      name: template_name,
      language: {
        code: "en",
        policy: "deterministic",
      },
      components: components,
    },
  };

  await axios
    .post(url, data, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    })
    .then((response) => {
      console.log(`Message Sent to ${phoneNumber}`);
      return "OK";
    })
    .catch((err) => {
      console.error(`Message Sending failed for ${phoneNumber}`);
      return "ERROR";
    });
}

// rate limiter
async function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
}

const fieldCoordinates = {
  " ECD has electricity": { x: 460, y: 447 },
  "Heating/Cooking is away from children's reach": { x: 460, y: 424 },
  "Structure appears stable": { x: 460, y: 401 },
  "Structure offers basic protection from sun, wind, and rain": {
    x: 460,
    y: 380,
  },
  "There is enough indoor light to play and learn": { x: 460, y: 357 },
  "Basic fire equipment present": { x: 460, y: 337 },
  "Clean drinking water is available on site": { x: 460, y: 315 },
  "Handwashing stations available onsite": { x: 460, y: 294 },
  "Adequate toilets/ablutions facilites (ratio of 1 toilet for 30children/1 potty for 5 children)":
    {
      x: 460,
      y: 262,
    },
  "Waste is out of children's reach": { x: 460, y: 232 },
};

const page2Fields = {
  "Designated sickbay area": { x: 485, y: 715 },
  "Are electric wires out of children's reach?": { x: 485, y: 690 },
  "Are floor surfaces smooth/safe": { x: 485, y: 667 },
  "Site is free from waste and debris": { x: 477, y: 638 },
  "ECD site is enclosed": { x: 485, y: 612 },
  "ECD site is not near hazards": { x: 485, y: 585 },
  "Walls are not crumbling/leaning over": { x: 485, y: 557 },
  "Roof is not leaking": { x: 485, y: 529 },
  "Separate food preparation area with piped hot water": { x: 485, y: 502 },
  "Walls are easy to clean": { x: 485, y: 474 },
  "Nappies are changed away from food preparation area": { x: 485, y: 450 },
  "Gas/paraffin & dangerous items are out of children's reach": {
    x: 485,
    y: 426,
  },
  "Emergency escape plan is displayed": { x: 485, y: 399 },
};

function buildSummary(data) {
  const owner = data["ECD Owner Name"] || "N/A";
  const business = data["Name of ECD Business"] || "N/A";
  const opened = data["Year ECD Opened"] || "N/A";
  const children = data["Number of Children"] || "N/A";
  const classrooms = data["Number of Classrooms"] || "N/A";
  const ablution = data["Ablution Facility"] || "N/A";
  const potties = data["Number of Potties"] || "N/A";

  return (
    `${owner} is the owner of ${business} located in the Greater Giyani Local. ` +
    `${business} was opened in ${opened} and has ${children} children in ${classrooms} classroom(s). ` +
    `The ECD has ${ablution}, and ${potties} pottie(s). ` +
    `${business} is not registered with the DBE and does not receive a state subsidy. ` +
    `The owner owns the land and has permission to occupy the space, and the ECD property is used for the ecd only.`
  );
}

function splitTextIntoLines(text, font, size, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let line = "";

  for (let word of words) {
    const testLine = line + word + " ";
    const width = font.widthOfTextAtSize(testLine, size);
    if (width > maxWidth) {
      lines.push(line.trim());
      line = word + " ";
    } else {
      line = testLine;
    }
  }
  if (line.trim()) lines.push(line.trim());
  return lines;
}

async function fillPdfWithData(data, index) {
  const existingPdfBytes = await fs.readFile(templatePDF);
  const pdfDoc = await PDFDocument.load(existingPdfBytes);
  const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);

  const pages = pdfDoc.getPages();
  const firstPage = pages[0];
  const secondPage = pages[1];

  const ownerName = data["ECD Owner Name"] || "N/A";
  firstPage.drawText(`${ownerName},`, {
    x: 61,
    y: 738,
    size: 12,
    font,
    color: rgb(0, 0, 0),
  });

  const summaryText = buildSummary(data);
  const summaryX = 43;
  let summaryY = 616;
  const summaryLines = splitTextIntoLines(summaryText, font, 12, 500);
  for (const line of summaryLines) {
    firstPage.drawText(line, {
      x: summaryX,
      y: summaryY,
      size: 12,
      font,
      color: rgb(0, 0, 0),
    });
    summaryY -= 15;
  }

  for (const field in fieldCoordinates) {
    const value = data[field] || "N/A";
    const positions = Array.isArray(fieldCoordinates[field])
      ? fieldCoordinates[field]
      : [fieldCoordinates[field]];

    for (const { x, y } of positions) {
      firstPage.drawText(value, {
        x,
        y,
        size: 12,
        font,
        color: rgb(0, 0, 0),
      });
    }
  }

  for (const field in page2Fields) {
    const value = data[field] || "N/A";
    const { x, y } = page2Fields[field];
    secondPage.drawText(value, {
      x,
      y,
      size: 12,
      font,
      color: rgb(0, 0, 0),
    });
  }

  const pdfBytes = await pdfDoc.save();
  const safeFileName = (ownerName || `entry_${index}`).replace(
    /[^a-zA-Z0-9-_]/g,
    "_"
  );
  const filePath = path.join(outputFolder, `${safeFileName}.pdf`);

  await fs.writeFile(filePath, pdfBytes);
  return filePath;
}

async function processCSV() {
  const results = [];

  fs.createReadStream(inputCSV)
    .pipe(csv())
    .on("data", (data) => results.push(data))
    .on("end", async () => {
      for (let i = 0; i < results.length; i++) {
        try {
          const filePath = await fillPdfWithData(results[i], i);
          // const pdfID = uploadMedia(filePath);
          sendMessage(/*results[i]["WhatsApp number"]*/ "62303025");
          await delay(1200);
        } catch (err) {
          console.error("Error creating PDF for entry:", i, err);
        }
      }
      console.log("All PDFs processed.");
    });
}

processCSV();

const PORT = process.env.PORT || 3000;
app.listen(PORT,()=>{
  console.log(`Server running on port ${PORT}`);
});