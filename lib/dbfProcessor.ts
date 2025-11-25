import { normalizeUTF8 } from './textNormalizers';
import { normalizeValue } from './coordinateUtils';

export function detectCoordinateColumnsFromRecord(record: any) {
  if (!record || typeof record !== 'object') {
    return null;
  }
  
  const keys = Object.keys(record);
  
  const xFields = ['X', 'x', 'COORD_X', 'coord_x', 'UTM_X', 'lon', 'longitude'];
  const yFields = ['Y', 'y', 'COORD_Y', 'coord_y', 'UTM_Y', 'lat', 'latitude'];
  const nameFields = ['NOMBRE', 'nombre', 'NOMBRE_', 'NOMBRE1', 'NAME', 'denominacion', 'TIPO', 'tipo'];
  
  let xValue: any = null;
  let xField: string | null = null;
  
  for (const field of xFields) {
    if (record[field] !== undefined && record[field] !== null && record[field] !== '') {
      xValue = record[field];
      xField = field;
      break;
    }
  }
  
  let yValue: any = null;
  let yField: string | null = null;
  
  for (const field of yFields) {
    if (record[field] !== undefined && record[field] !== null && record[field] !== '') {
      yValue = record[field];
      yField = field;
      break;
    }
  }
  
  if (!xValue || !yValue) {
    const numericFields = keys.filter(key => {
      const val = record[key];
      return typeof val === 'number' && Math.abs(val) > 1000;
    });
    
    if (numericFields.length >= 2) {
      xValue = xValue || record[numericFields[0]];
      yValue = yValue || record[numericFields[1]];
      xField = xField || numericFields[0];
      yField = yField || numericFields[1];
    }
  }
  
  if (!xValue || !yValue) {
    return null;
  }
  
  let nameValue = 'Sin nombre';
  for (const field of nameFields) {
    if (record[field] && String(record[field]).trim()) {
      nameValue = String(record[field]).trim();
      break;
    }
  }
  
  const description = keys
    .slice(0, 5)
    .filter(k => k && record[k] !== null && record[k] !== undefined)
    .map(k => `${k}: ${record[k]}`)
    .join(', ');
  
  console.log(`🎯 Coords detectadas: ${xField}=${xValue}, ${yField}=${yValue}`);
  
  return {
    x: xValue,
    y: yValue,
    name: nameValue,
    description: description || 'Sin descripción',
    xField,
    yField
  };
}

function decodeBytesManual(bytes: Uint8Array): string {
  let str = '';
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];
    if (byte === 0) break;
    str += String.fromCharCode(byte);
  }
  return str.trim();
}

function readDBF(buffer: ArrayBuffer): any[] {
  const view = new DataView(buffer);
  
  const version = view.getUint8(0);
  const recordCount = view.getUint32(4, true);
  const headerLength = view.getUint16(8, true);
  const recordLength = view.getUint16(10, true);
  
  console.log(`📊 DBF: ${recordCount} registros, header: ${headerLength} bytes`);
  
  const fields: Array<{
    name: string;
    type: string;
    length: number;
    decimals: number;
  }> = [];
  
  let offset = 32;
  
  while (offset < headerLength - 1) {
    const fieldNameBytes = new Uint8Array(buffer, offset, 11);
    const fieldName = decodeBytesManual(fieldNameBytes);
    
    const fieldType = String.fromCharCode(view.getUint8(offset + 11));
    const fieldLength = view.getUint8(offset + 16);
    const fieldDecimals = view.getUint8(offset + 17);
    
    if (fieldName) {
      fields.push({ 
        name: fieldName, 
        type: fieldType, 
        length: fieldLength, 
        decimals: fieldDecimals 
      });
    }
    
    offset += 32;
    if (view.getUint8(offset) === 0x0D) break;
  }
  
  console.log('📋 Campos:', fields.map(f => `${f.name} (${f.type})`).join(', '));
  
  const records: any[] = [];
  let recordOffset = headerLength;
  let successCount = 0;
  let skippedCount = 0;
  
  for (let i = 0; i < recordCount; i++) {
    const deletedFlag = view.getUint8(recordOffset);
    recordOffset++;
    
    if (deletedFlag === 0x2A) {
      recordOffset += recordLength - 1;
      skippedCount++;
      continue;
    }
    
    const record: any = {};
    
    for (const field of fields) {
      const bytes = new Uint8Array(buffer, recordOffset, field.length);
      let value: any = decodeBytesManual(bytes);
      
      if (field.type === 'N' || field.type === 'F') {
        const cleanValue = value.replace(',', '.').replace(/\s+/g, '');
        value = cleanValue ? parseFloat(cleanValue) : null;
      }
      
      if (typeof value === 'string' && value) {
        value = normalizeUTF8(value);
      }
      
      record[field.name] = value;
      recordOffset += field.length;
    }
    
    records.push(record);
    successCount++;
  }
  
  console.log(`✅ DBF procesado: ${successCount} registros leídos`);
  if (skippedCount > 0) {
    console.log(`⏭️  ${skippedCount} registros borrados omitidos`);
  }
  
  return records;
}

export async function processDBF(file: File): Promise<any[]> {
  const buffer = await file.arrayBuffer();
  return readDBF(buffer);
}
