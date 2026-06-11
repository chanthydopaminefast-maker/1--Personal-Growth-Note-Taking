const str = "N2R2ZHcwS01";
const b = Buffer.from(str, 'base64').toString('utf8');
console.log("DECODED N2R:");
console.log(b);

const str2 = "XG4gICA";
const b2 = Buffer.from(str2, 'base64').toString('utf8');
console.log("DECODED XG4:");
console.log(b2);
