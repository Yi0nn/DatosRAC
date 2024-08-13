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
    const { updates, sheetName } = req.body;
    console.log('Datos recibidos:', req.body);

    const spreadsheetId = '1s38PjrQ-T0YwAduJwQXDWbVtuIuJIa48C4XtqpdkkdQ';
    const sheets = google.sheets({ version: 'v4', auth: jwtClient });

    // Obtener todos los valores de la hoja
    const responseSheet = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A1:Z1000`,
    });

    const currentValues = responseSheet.data.values;

    // Procesar cada actualización en el array
    for (let update of updates) {
      const { id, updateData } = update;
      const rowIndex = currentValues.findIndex(row => row[0] == id);

      if (rowIndex === -1) {
        console.log('ID no encontrado:', id);
        return res.status(404).json({ error: `ID ${id} no encontrado`, status: false });
      }

      console.log('Fila encontrada:', currentValues[rowIndex]);

      // Actualiza solo el valor en la columna correspondiente
      const updatedRow = [...currentValues[rowIndex]];
      updatedRow[5] = updateData.valor; // Asumiendo que la columna "VALOR" es la sexta columna (índice 5)

      const updatedRange = `${sheetName}!A${rowIndex + 1}:Z${rowIndex + 1}`;
      console.log('Actualizando fila en el rango:', updatedRange);
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: updatedRange,
        valueInputOption: 'RAW',
        resource: {
          values: [updatedRow],
        },
      });
    }

    console.log('Actualizaciones exitosas.');
    return res.status(200).json({ success: 'Se actualizaron correctamente', status: true });
  } catch (error) {
    console.error('Error en la conexión:', error);
    return res.status(400).json({ error: 'Error en la conexión', status: false });
  }
});

app.use(router);

app.listen(PORT, () => {
  console.log(`Servidor backend escuchando en el puerto ${PORT}`);
});
