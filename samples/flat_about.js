/*
 *  flat_about.js
 *
 *  David Janes
 *  IOTDB.org
 *  2016-01-05
 *
 *  Make sure to see README first
 */

var FSTransport = require('../FSTransport').FSTransport;

var transport = new FSTransport({
    flat_band: "megatron",
    prefix: ".flat",
});
transport.about({
    id: "MyThingID", 
}, function(ad) {
    console.log("+", ad);
});
