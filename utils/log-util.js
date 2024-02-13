const fs = require('fs');
const path = require('path');

const logStream = fs.createWriteStream(path.join(__dirname, '../bot.log'), { flags: 'a' });

function logMessage(message, isError = false) {
    isError ? console.error(message) : console.log(message);
    logStream.write(`${new Date().toISOString()} - ${message}\n`);
}

function appendErrorToMessage(msg, error) {
    if (error) {
        if (error.message) {
            msg += error.message;
        }
        if (error.stack) {
            msg += ' | stack: ' + error.stack;
        }
    }
    return msg;
}

module.exports = { logMessage, appendErrorToMessage }