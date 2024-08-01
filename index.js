const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
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

	const response = await sheets.spreadsheets.values.get({
  	spreadsheetId,
  	range,
	});

	const values = response.data.values;
	const data = sheetValuesToObject(values);

	res.status(200).json({ status: true, data });
  } catch (error) {
	console.error('Error:', error);
	res.status(400).json({ status: false, error });
  }
});

// Ruta para actualizar datos en Google Sheets
router.post('/updateData', async (req, res) => {
	try {
	  const { id, updateData, sheetName } = req.body;
	  console.log('Datos recibidos:', req.body);
	  const spreadsheetId = '1s38PjrQ-T0YwAduJwQXDWbVtuIuJIa48C4XtqpdkkdQ';
	const range = `${sheetName}!A1:Z1000`;
	const sheets = google.sheets({ version: 'v4', auth: jwtClient });

    const responseSheet = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const currentValues = responseSheet.data.values;
    const rowIndex = currentValues.findIndex(row => row[0] == id);

    if (rowIndex === -1) {
      return res.status(404).json({ error: 'ID no encontrado', status: false });
    }

    // Actualiza solo el valor en la columna correspondiente
    const updatedRow = [...currentValues[rowIndex]];
    updatedRow[5] = updateData.valor; // Asumiendo que la columna "VALOR" es la sexta columna (índice 5)
	const updatedRange = `${sheetName}!A${rowIndex + 1}`;
	const sheetsResponse = await sheets.spreadsheets.values.update({
		spreadsheetId,
		range: updatedRange,
		valueInputOption: 'RAW',
		resource: {
		  values: [updatedRow],
		},
	  });
  
	  if (sheetsResponse.status === 200) {
		return res.status(200).json({ success: 'Se actualizó correctamente', status: true });
	  } else {
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
