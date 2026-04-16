const str = "PLU\t1\t0\t456\t1\t15,1\t0,0\t0,0\t0\t0\t0\t0\t0\t0\t9\tapple\t\t\t\t\t\t\t\t0\t0\t0\t0\t0\t0\t0\t0\t0\t0\t0\t0\t0,0\t0,0\t0\t127\t0,0\t0,0\t0,0\t0\t127\t0,0\t0,0\t0,0\t0\t127\t0,0\t0,0\t0,0\t0\t127\t0,0\t0,0\t0,0\t0\t0\t0\t0\t0\t0\t0\tapple\t0\t0\t0\t";
const cols = str.split('\t');
console.log("Array length:", cols.length);
for (let i = 0; i < 30; i++) {
    console.log(`${i}:`, cols[i]);
}
