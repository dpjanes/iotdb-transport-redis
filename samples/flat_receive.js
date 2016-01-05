/*
 *  flat_receive.js
 *
 *  David Janes
 *  IOTDB.org
 *  2016-01-05
 *
 *  Make sure to see README first
 */

var transport = require('../index');
var FSTransport = transport.Transport;

var p = new FSTransport({
    flat_band: "megatron"
});
p.updated({
    id: "MyThingID", 
    band: "meta", 
}, function(ud) {
    if (ud.value === undefined) {
        p.get(ud, function(gd) {
            console.log("+", gd.id, gd.band, gd.value);
        });
    } else {
        console.log("+", ud.id, ud.band, ud.value);
    }
});
