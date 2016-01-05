/*
 *  flat_list.js
 *
 *  David Janes
 *  IOTDB.org
 *  2016-01-05
 *
 *  Make sure to see README first
 */

var FSTransport = require('../FSTransport').FSTransport;

var p = new FSTransport({
    flat_band: "megatron",
    prefix: ".flat",
});
p.list(function(ld) {
    if (!ld) {
        return;
    }
    console.log("+", ld.id);
});
