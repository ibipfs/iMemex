import '@babel/polyfill';
import MIME from 'mime/lite';
import 'fast-text-encoding';
import './alert';
import './polyfill/webcrypto-shim';
import './polyfill/remove';
import Log from './log/Log';
import './services/background';
import GetURLParameter from './services/urlParameter';
import Encryption from './services/Encryption';
import Iota from './log/Iota';
import { saveAs } from './services/fileSaver';
import Ping from './services/Ping';
import GetGateway from './services/getGateway';
import '../css/style.css';
import '../css/alert.css';
import '../css/menu.css';

const gateway = GetGateway();
/**
 *
 * @param {string} msg
 */
function output(msg) {
  const m = document.getElementById('messages');
  m.innerHTML = msg;
}

function downloadFile(fileId, fileName, blob, isEncrypted) {
  const p = new Ping();
  p.ping((err) => {
    if (err) {
      output('Something is blocking the log entry!');
    }
    new Log().createLog(fileId, fileName, false, gateway, isEncrypted);
    saveAs(blob, fileName);
  });
}

function progressBar(percent) {
  const elem = document.getElementById('loadBar');
  elem.style.width = `${percent}%`;
  if (percent >= 100) {
    document.getElementById('loadProgress').style.display = 'none';
  }
}

async function load() {
  const passwordInput = document.getElementById('passwordField').value;
  let fileInput = document.getElementById('firstField').value;
  if (fileInput.length !== 46 && typeof fileInput !== 'undefined') {
    // means file names instead of file id
    const iota = new Iota();
    if (fileInput.includes('.')) {
      const [fileIn] = fileInput.split('.');
      fileInput = fileIn;
    }
    const [firstTransaction] = await iota.getTransactionByName(fileInput.trim());
    if (typeof (firstTransaction) !== 'undefined') {
      fileInput = await iota.getAddress(firstTransaction);
    } else {
      fileInput = 'wrongName';
    }
  }
  if (fileInput === 'wrongName' || (passwordInput.length === 43 && fileInput.length !== 46)) {
    // unencrypted files can be downloaded by name instead of file id!
    output('You have entered an invalid filename!');
  } else if (passwordInput.length !== 43 && passwordInput !== '' && passwordInput !== 'nopass') {
    output('You have entered an invalid password!');
  } else if (!/^[a-zA-Z0-9_.-]*$/.test(passwordInput)) {
    output('You have entered an invalid password!');
  } else if (!/^[a-zA-Z0-9]*$/.test(fileInput)) {
    output('You have entered an invalid filename!');
  } else {
    output('');
    const oReq = new XMLHttpRequest();
    document.getElementById('response').classList.remove('hidden');
    oReq.onloadstart = function onloadstart() {
      document.getElementById('loadProgress').style.display = 'block';
    };
    oReq.onload = function onload() {
      const arrayBuffer = oReq.response;
      const fileNameLength = new TextDecoder('utf-8').decode(arrayBuffer.slice(0, 4)) - 1000;
      const fileName = new TextDecoder('utf-8').decode(
        arrayBuffer.slice(4, fileNameLength + 4),
      );
      // encrypted
      if (passwordInput !== '' && passwordInput !== 'nopass') {
        const initialVector = new Uint8Array(
          arrayBuffer.slice(4 + fileNameLength, 16 + fileNameLength),
        );
        const fileArray = new Uint8Array(
          arrayBuffer.slice(16 + fileNameLength),
        );
        const enc = new Encryption();
        const keyPromise = enc.importKey(passwordInput);
        keyPromise
          .then((key) => {
            const decryptPromise = enc.decrypt(initialVector, key, fileArray);
            decryptPromise
              .then((decrypted) => {
                const typeM = MIME.getType(fileName);
                const blob = new Blob([decrypted], { type: typeM });
                blob.name = fileName;
                downloadFile(fileInput, fileName, blob, true);
              })
              .catch(() => {
                output('You have entered an invalid password!');
              });
          })
          .catch(() => {
            output('You have entered an invalid password!');
          });
      } else {
        // not encrypted
        const fileArray = new Uint8Array(
          arrayBuffer.slice(4 + fileNameLength),
        );
        const typeM = MIME.getType(fileName);
        const blob = new Blob([fileArray], { type: typeM });
        blob.name = fileName;
        downloadFile(fileInput, fileName, blob, false);
      }
    };
    oReq.onprogress = function onprogress(e) {
      if (e.lengthComputable) {
        const per = Math.round((e.loaded * 100) / e.total);
        progressBar(per);
      }
    };
    oReq.onreadystatechange = function onreadystatechange() {
      // Ready State 4 = operation completed
      if (oReq.readyState === 4) {
        if (oReq.status !== 200) {
          output('You have entered an invalid filename!');
        }
      }
    };

    oReq.open('GET', gateway + fileInput, true);
    oReq.responseType = 'arraybuffer';
    oReq.send();
  }
}


document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('load').onclick = load;
  const filename = GetURLParameter('id');
  const password = GetURLParameter('password');
  // contains file name
  if (typeof filename !== 'undefined') {
    document.getElementById('firstField').value = filename;
    document.getElementById('firstField').style.display = 'none';
    if (typeof password !== 'undefined') {
      document.getElementById('passwordField').value = password;
    } else {
      document.getElementById('passwordField').style.display = 'block';
      document.getElementById('passwordField').focus();
      document
        .getElementById('passwordField')
        .addEventListener('keyup', (event) => {
          event.preventDefault();
          if (event.keyCode === 13) {
            document.getElementById('load').click();
          }
        });
    }
  } else {
    // password input file should only open with the link
    document.getElementById('firstField').focus();
    document
      .getElementById('firstField')
      .addEventListener('keyup', (event) => {
        event.preventDefault();
        if (event.keyCode === 13) {
          document.getElementById('load').click();
        }
      });
  }
});
