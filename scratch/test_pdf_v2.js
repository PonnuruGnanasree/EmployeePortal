const { PDFParse } = require('pdf-parse');
const fs = require('fs');

const dataBuffer = fs.readFileSync('c:/Users/GnanaSreePonnuru/Documents/gantec/Employeeportal/scratch/test.pdf');

const parser = new PDFParse();
parser.parse(dataBuffer).then(data => {
  console.log('Text:', data.text);
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
