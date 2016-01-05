/*
 *  flat_send.js
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
    flat_band: "megatron",
});

var _update = function() {
    var now = (new Date()).toISOString();
    console.log("+ sent update", now);
    p.update({
        id: "MyThingID", 
        band: "meta", // ignored
        value: {
            first: "David",
            last: "Janes",
            now: now,
        },
    });
};

setInterval(_update, 10 * 1000);
_update();
