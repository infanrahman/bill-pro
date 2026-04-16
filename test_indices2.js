const str = "PLU\t1\t0\t456\t1\t15,1\t0,0\t0,0\t0\t0\t0\t0\t0\t0\t9\tapple\t\t\t\t\t\t\t\t0\t0\t0\t0\t0\t0\t0\t0\t0\t0\t0\t0\t0,0\t0,0\t0\t127\t0,0\t0,0\t0,0\t0\t127\t0,0\t0,0\t0,0\t0\t127\t0,0\t0,0\t0,0\t0\t127\t0,0\t0,0\t0,0\t0\t0\t0\t0\t0\t0\t0\tapple\t0\t0\t0\t";
const cols = str.split('\t');

const parsed = {
    plu: parseInt(cols[1]) || 0,
    name: cols[15] || 'Unknown',
    price: parseFloat((cols[5] || '0').replace(',', '.')) || 0,
    unit: parseInt(cols[4]) === 1 ? 'Piece' : 'Weight',
    itemCode: cols[2] || '0',
    indexBarcode: cols[3] || '0',
};

console.log(parsed);
