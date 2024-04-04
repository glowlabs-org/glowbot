const fs = require('fs');
const path = require('path');

async function getFileData(dbFilePath) {
    let data = []

    console.log(dbFilePath)
    console.log(fs.existsSync(path.join(__dirname, '../db')))
    // create db folder if it doesn't exist already
    if (!fs.existsSync(dbFilePath)) {
        fs.mkdirSync(path.join(__dirname, '../db'), { recursive: true });
    } else {
        data = JSON.parse(fs.readFileSync(dbFilePath, 'utf8'));
    }
    return data;
}

module.exports = { getFileData }