function crc16(str) {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }
  return (crc & 0xffff).toString(16).toUpperCase().padStart(4, "0");
}

const payload = "00020101021226820014BR.GOV.BCB.PIX01600000000000000000000000000000000000000000000000000000000000000000520400005303986540510.005802BR5912TESTE NOME 6009SAO PAULO62070503***6304";
console.log("CRC:", crc16(payload));
