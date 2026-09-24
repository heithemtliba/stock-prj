require("dotenv").config();
const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3002,
  path: '/rapport-hebdomadaire',
  method: 'POST'
};

const req = http.request(options, res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    try {
      const j = JSON.parse(d);
      console.log('analyseRetours present:', !!j.analyseRetours);
      console.log('jobId:', j.jobId);
    } catch(e) {
      console.log('Response:', d.substring(0, 200));
    }
  });
});
req.end();
