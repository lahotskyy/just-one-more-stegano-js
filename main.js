const fs = require('fs');
const PNG = require('pngjs').PNG;
const cliArgs = require('command-line-args');
const terminatorChar = '03';

parseInput();

function parseInput() {
  const cliOptions = [
    { name: 'hide', alias: 'h', type: Boolean },
    { name: 'parse', alias: 'p', type: Boolean },
    { name: 'image', alias: 'i', type: String },
    { name: 'text', alias: 't', type: String },
  ];

  const params = cliArgs(cliOptions);

  if (!params.hide && !params.parse) { throw 'dude, either --parse or --hide' }
  if (!params.image) { throw 'you\'d better provide some --image' }
  if (params.image && params.image.slice(-4) !== '.png') { throw 'only \'.png\', sry' }

  if (params.parse) { showData(params) }

  if (params.hide) {
    if (!params.text) throw 'use --text to hide some text';

    hideData(params);
  }
}

function hideData(params) {
  const inputData = strToHex(params.text) + terminatorChar;
  console.log(inputData);
  const keyMatrix = createKeyMatrix();

  parseImage(params.image).then((png) => {
    const newBackground = transformBackground(png.data, inputData, keyMatrix);
    png.data = Buffer.from(newBackground);
    png.pack().pipe(fs.createWriteStream('here-you-have.png'));
  });
}

function showData(params) {
  const keyMatrix = createKeyMatrix();
  parseImage(params.image).then((png) => {
    const data = png.data.filter(filterAplha);
    let index = 0;
    let res = '';
    let parseCompleted = false;

    while (!parseCompleted && index < data.length) {
      res += keyMatrix[data[index]][data[index+1]];
      index += 2;
      if (res.slice(-2) === terminatorChar) {
        parseCompleted = true;
        res = res.slice(0, -2);
      }
    }

    res = hexToStr(res);
    console.log(res);
    return res;
  });
}

function transformBackground(background, input, keyMatrix) {
  background = background.filter(filterAplha);
  let index = 0;
  let data = [];

  input.split('').forEach(char => {
    data.push(findNearest(keyMatrix, char, background[index], background[index+1]));
    index += 2;
  });

  data = data.reduce((accum, current) => {
    accum.push(current.x);
    accum.push(current.y);
    return accum;
  }, []);

  while(data.length < background.length) {
    data[data.length] = background[data.length];
  }

  const newBackground = [];

  data.forEach((val, index) => {
    newBackground.push(val);
    if (!((index+1) % 3)) {
      newBackground.push(255); //restore alpha
    }
  });

  return newBackground;
}

function findNearest(matrix, char, initX, initY) {
  let result;
  let availableList = [{x: initX, y: initY}];
  let usedList = [];

  result = availableList.find(({x, y}) => matrix[x][y] === char);
  while (!result) {
    usedList = usedList.concat(availableList);
    availableList = findNeighbors(availableList, usedList);
    result = availableList.find(({x, y}) => matrix[x][y] === char);
  }

  return result;
}

function findNeighbors(list, usedList) {
  const neighbors = [];

  list.forEach(l => {
    [ {x: l.x+1, y: l.y}, {x: l.x-1, y: l.y}, {x: l.x, y: l.y+1}, {x: l.x, y: l.y-1},  ].forEach(m => {
      if (!usedList.find(k => k.x === m.x && k.y === m.y) && m.x >= 0 && m.x <=255 && m.y >= 0 && m.y <= 255) {
        neighbors.push(m);
      }
    });
  });

  return neighbors;
}

function filterAplha(v, index, arr) {
  return (index+1)%4;
}

function createKeyMatrix(key) {
  const defaultKey = [
    ['0', '1', '2', '3', ],
    ['4', '5', '6', '7', ],
    ['8', '9', 'a', 'b', ],
    ['c', 'd', 'e', 'f', ],
  ];

  key = key || defaultKey;

  const matrix = [];

  for (let i = 0; i < 256; i++) {
    if (!matrix[i]) { matrix[i] = [] }

    for (let j = 0; j < 256; j++) {
      matrix[i][j] = key[i%4][j%4];
    }
  }

  return matrix;
}

function parseImage(img) {
  return new Promise((resolve, reject) => {
    fs.createReadStream(img)
    .pipe(new PNG({}))
    .on('parsed', function() {
      resolve(this);
    });
  });
}

function strToHex(str) {
  let hexStr = '';
  for(let i = 0; i < str.length; i++) {
    hexStr += str.charCodeAt(i).toString(16);
  }
  return hexStr;
}

function hexToStr(hexStr) {
  let index = 0;
  const hexArr = [];

  while(index < hexStr.length) {
    hexArr.push(hexStr[index] + hexStr[index+1]);
    index += 2;
  }

  let res = ''
  const decArr = hexArr.map(v => parseInt(v, 16));
  decArr.forEach(v => res += String.fromCharCode(v));
  return res;
}