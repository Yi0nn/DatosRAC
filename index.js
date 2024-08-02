const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { google } = require('googleapis');
const { sheetValuesToObject } = require('./utils');
const { config } = require('dotenv');
const { jwtClient } = require('./google');
config();

const app = express();
const router = express.Router();
const PORT = process.env.PORT || 3001;

app.use(bodyParser.json());
app.use(cors());

// Ruta para la raíz
app.get('/', (req, res) => {
  res.send('El servidor está funcionando correctamente');
});

// Ruta para obtener datos de Google Sheets
router.post('/getData', async (req, res) => {
  try {
    const { sheetName } = req.body;
    const spreadsheetId = '1s38PjrQ-T0YwAduJwQXDWbVtuIuJIa48C4XtqpdkkdQ';
    const range = `${sheetName}!A1:Z1000`; // Rango a obtener
    const sheets = google.sheets({ version: 'v4', auth: jwtClient });

    console.log('Obteniendo datos de la hoja:', sheetName);
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const values = response.data.values;
    const data = sheetValuesToObject(values);

    console.log('Datos obtenidos:', data);
    res.status(200).json({ status: true, data });
  } catch (error) {
    console.error('Error al obtener datos:', error);
    res.status(400).json({ status: false, error });
  }
});

// Nueva función para actualizar datos en Google Sheets
router.post('/updateData', async (req, res) => {
  try {
    const { id, updateData, sheetName } = req.body;
    console.log('Datos recibidos:', req.body);

    const spreadsheetId = '1s38PjrQ-T0YwAduJwQXDWbVtuIuJIa48C4XtqpdkkdQ';
    const sheets = google.sheets({ version: 'v4', auth: jwtClient });

    // Obtener todos los valores de la hoja
    const responseSheet = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A1:Z1000`,
    });

    const currentValues = responseSheet.data.values;
    const rowIndex = currentValues.findIndex(row => row[0] == id);

    if (rowIndex === -1) {
      console.log('ID no encontrado:', id);
      return res.status(404).json({ error: 'ID no encontrado', status: false });
    }

    console.log('Fila encontrada:', currentValues[rowIndex]);

    // Obtener rangos protegidos de la hoja de cálculo
    const metadataResponse = await sheets.spreadsheets.get({
      spreadsheetId,
      ranges: [`${sheetName}`],
      fields: 'sheets.protectedRanges',
    });

    const protectedRanges = metadataResponse.data.sheets.flatMap(sheet =>
      sheet.protectedRanges ? sheet.protectedRanges.map(range => range.range) : []
    );

    const isProtected = protectedRanges.some(range => {
      return (
        range.startRowIndex <= rowIndex &&
        rowIndex < range.endRowIndex &&
        range.startColumnIndex <= 5 &&
        5 < range.endColumnIndex
      );
    });

    if (isProtected) {
      console.log('La celda está protegida.');
      return res.status(403).json({ error: 'La celda está protegida. No se puede actualizar.', status: false });
    }

    // Actualiza solo el valor en la columna correspondiente
    const updatedRow = [...currentValues[rowIndex]];
    updatedRow[5] = updateData.valor; // Asumiendo que la columna "VALOR" es la sexta columna (índice 5)

    const updatedRange = `${sheetName}!A${rowIndex + 1}:Z${rowIndex + 1}`;
    console.log('Actualizando fila en el rango:', updatedRange);
    const sheetsResponse = await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: updatedRange,
      valueInputOption: 'RAW',
      resource: {
        values: [updatedRow],
      },
    });

    if (sheetsResponse.status === 200) {
      console.log('Actualización exitosa.');
      return res.status(200).json({ success: 'Se actualizó correctamente', status: true });
    } else {
      console.log('Error al actualizar.');
      return res.status(400).json({ error: 'No se actualizó', status: false });
    }
  } catch (error) {
    console.error('Error en la conexión:', error);
    return res.status(400).json({ error: 'Error en la conexión', status: false });
  }
});

app.use(router);

app.listen(PORT, () => {
  console.log(`Servidor backend escuchando en el puerto ${PORT}`);
});
