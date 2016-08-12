"use strict";

const iotdb = require('iotdb');
const _ = iotdb._;

const connect = require("../connect")
const redis_client = connect.connect(require("./redis.json"), error => {
    if (error) {
        console.log("#", _.error.message(error));
    }

    console.log("-", "connected");
});

setInterval(() => {
    console.log("-", "ensure");
    redis_client.ensure(error => {
        if (error) {
            console.log("#", _.error.message(error));
            return;
        }

        console.log("-", "ensured");
        redis_client.keys("*", (error, results) => {
            console.log("results", results);
        });
    });
}, 10 * 1000);
