
let txOptions = null;
if(txOptions && !Number.isNaN(Number(txOptions))) {
    txOptions = {
      gasLimit: txOptions,
    }
  }
console.log(txOptions)