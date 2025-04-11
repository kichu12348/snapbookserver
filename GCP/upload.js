const express = require('express');
const fs = require('fs');
const path = require('path');
const Busboy = require('busboy');
const { uploadFile,deleteFileFromGcp } = require('./uploadGcp'); // adjust path as needed

const router = express.Router();

router.post('/upload', (req, res) => {
  const busboy = Busboy({ headers: req.headers });
  let uploadComplete = true;
  let fileInfo = null;

  //check if uploads directory exists, if not create it
  const uploadDir = path.join(__dirname, '../uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
    const permName = `${Date.now()}-${filename.filename}`;
    const savePath = path.join(__dirname, '../uploads', permName);
    fileInfo = { name: permName, mimeType:filename.mimeType };
    const writeStream = fs.createWriteStream(savePath);
    file.pipe(writeStream);

    writeStream.on('close', () => {
      uploadComplete = true;
    });
    writeStream.on('error', (err) => {
      console.error('Error writing file:', err);
      uploadComplete = false;
      res.status(500).json({ message: 'File write error' });
    });
  });
  busboy.on('finish', async () => {
    if (!uploadComplete || !fileInfo) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    try {
      const publicUrl = await uploadFile(fileInfo);
      return res.status(200).json({ uri: publicUrl });
    } catch (err) {
      console.error('Upload to GCP failed:', err.message);
      return res.status(500).json({ message: 'GCP upload failed: '+err.message });
    }
  });

  req.pipe(busboy);
});


router.post('/delete',deleteFileFromGcp);

module.exports = router;
