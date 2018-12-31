import '../services/tableToCsv';
import Iota from '../iota/Iota';
import FileType from '../services/FileType';
import compareTime from '../helperFunctions/compareTime';
import '../../css/table.css';
import '../polyfill/remove';
import db from '../log/logDb';
import Signature from '../crypto/Signature';
import prepObjectForSignature from '../crypto/prepObjectForSignature';

const iotaFlags = {};

function hideColumns(col1) {
  const tbl = document.getElementById('table');
  if (tbl != null) {
    for (let i = 0; i < tbl.rows.length; i += 1) {
      for (let j = 0; j < tbl.rows[i].cells.length; j += 1) {
        tbl.rows[i].cells[j].style.display = '';
        if (j === col1) { tbl.rows[i].cells[j].style.display = 'none'; }
      }
    }
  }
}

function printLog(iotaLogArray, logsDb) {
  iotaLogArray.sort(compareTime);
  document.getElementById('csvDownload').style.visibility = 'visible';
  document.getElementById('clearHistory').style.visibility = 'visible';
  for (let j = 0; j < iotaLogArray.length; j += 1) {
    if (!iotaFlags[iotaLogArray[j].fileId]) {
      iotaFlags[iotaLogArray[j].fileId] = true;
      const table = document.getElementById('table');
      const row = table.insertRow(-1);
      const cell1 = row.insertCell(0);
      cell1.setAttribute('data-title', 'Icons: ');
      const cell2 = row.insertCell(1);
      cell2.setAttribute('data-title', 'Name: ');
      const cell3 = row.insertCell(2);
      cell3.setAttribute('data-title', 'File ID: ');
      const cell4 = row.insertCell(3);
      cell4.setAttribute('data-title', 'Mode: ');
      const cell5 = row.insertCell(4);
      cell5.setAttribute('data-title', 'Upload: ');
      const cell6 = row.insertCell(5);
      cell6.setAttribute('data-title', 'Download: ');
      const linkText = logsDb.find(x => x.fileId === iotaLogArray[j].fileId).filename;
      const link = `${window.location.href.replace('history', 'receive')
      }?id=${
        iotaLogArray[j].fileId
      }`;

      const [, , fileTypePart] = linkText.match(/(.*)\.(.*)/);
      cell1.innerHTML = FileType.returnFileIcon(fileTypePart);
      cell1.style.fontSize = '18px';
      cell2.innerHTML = `<a href="${link}" target="_blank">${linkText}</a>`;
      cell3.textContent = iotaLogArray[j].fileId;
      cell4.textContent = 'Private';

      const downloadArray = iotaLogArray.filter(
        x => x.fileId === iotaLogArray[j].fileId && !x.isUpload,
      );
      const uploadArray = iotaLogArray.filter(
        x => x.fileId === iotaLogArray[j].fileId && x.isUpload,
      );

      let cellUpload = 'N/A';
      for (let i = 0; i < uploadArray.length; i += 1) {
        if (i === 0) {
          cellUpload = uploadArray[i].time.replace(',', '');
        } else {
          cellUpload = `${cellUpload}\n ${uploadArray[i].time.replace(',', '')}`;
        }
      }
      cell5.textContent = cellUpload;

      let cellDownload = 'N/A';
      for (let i = 0; i < downloadArray.length; i += 1) {
        if (i === 0) {
          cellDownload = downloadArray[i].time.replace(',', '');
        } else {
          cellDownload = `${cellDownload}\n ${downloadArray[i].time.replace(',', '')}`;
        }
      }
      cell6.textContent = cellDownload;
    }
  }
  hideColumns(2);
  if (document.getElementById('firstRow') !== null) {
    document.getElementById('firstRow').remove();
  }
}

async function createListOfLogs(logsDb) {
  const iotaLogArray = [];
  const iota = new Iota();
  const sig = new Signature();
  const logFlags = {};
  await Promise.all(
    logsDb.map(async (logObject) => {
      if (!logFlags[logObject.fileId]) {
        logFlags[logObject.fileId] = true;
        const transactions = await iota.getTransactionByHash(logObject.fileId);
        await Promise.all(
          transactions.map(async (transaction) => {
            let logObj = await iota.getMessage(transaction);
            const publicKey = await sig.importPublicKey(logObj.publicHexKey);
            const { signature } = logObj;
            logObj = prepObjectForSignature(logObj);
            const isVerified = await sig.verify(publicKey, signature, JSON.stringify(logObj));
            if (isVerified) {
              iotaLogArray.push(logObj);
            }
          }),
        );
      }
    }),
  );
  document.getElementById('loader').style.visibility = 'hidden';
  if (iotaLogArray.length > 0) {
    printLog(iotaLogArray, logsDb);
  }
}

document.getElementById('clearHistory').addEventListener('click', async () => {
  await db.log.clear();
  window.location.reload();
});

document.getElementById('toFile').addEventListener('click', async () => {
  try {
    const logsDb = await db.log.toArray();
    if (logsDb == null) {
      document.getElementById('csvDownload').style.visibility = 'hidden';
      document.getElementById('clearHistory').style.visibility = 'hidden';
    } else {
      document.getElementById('loader').style.visibility = 'visible';
      createListOfLogs(logsDb);
    }
  } catch (error) {
    console.log(error);
    document.getElementById('logResult').innerHTML = 'Sorry, your browser does not support Web Storage.';
  }
});
