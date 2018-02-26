const mime = require('mime');

const dataUriRegExp = /data:(image\/.*);base64,(.*)/;

function decode(dataUri) {
  const match = dataUri.match(dataUriRegExp);
  if (!match) {
    throw new Error('Error, image is not a data URI');
  }
  return {
    extension: mime.getExtension(match[1]).replace('jpeg', 'jpg'),
    data: Buffer.from(match[2], 'base64')
  };
}

function encode(data, mimeType) {
  if (!data || !mimeType) {
    throw new Error('Error, missing data or type for image');
  }
  const encodedData = (Buffer.isBuffer(data) ? data : Buffer.from(data)).toString('base64');
  return `data:${mimeType};base64,${encodedData}`;
}

module.exports = {
  decode,
  encode
};
