
const RoonApi = require("node-roon-api"),
    RoonApiTransport = require('node-roon-api-transport'),
    RoonApiImage = require('node-roon-api-image'),
    RoonApiBrowse = require('node-roon-api-browse');

const WebSocketServer = require('ws').Server;

const wss = new WebSocketServer({ port: 9060 });

wss.on('connection', function connection(ws) {
    ws.on('error', console.error);
    ws.on('message', function message(data) {
        console.log('received: %s', data);
    });
});


let core;
let zones

const roon = new RoonApi({
    extension_id: 'com.cbillette.audio.state',
    display_name: "Audio State WS",
    display_version: "1.0.0",
    publisher: 'Charles Billette',
    email: 'charles@cbillette.com',
    log_level: 'none',

    core_paired: function (core_) {
        core = core_;
        core.services.RoonApiTransport.subscribe_zones((response, msg) => {
            // console.log("Response: ", response);
            if (response == "Subscribed") {
                zones = msg.zones.reduce((p, e) => (p[e.zone_id] = e) && p, {});
                wss.clients.forEach(function each(client) {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify(zones));
                    }
                });
                // v.$set('zones', zones);
            } else if (response == "Changed") {
                if (msg.zones_removed) msg.zones_removed.forEach(e => delete (zones[e.zone_id]));
                if (msg.zones_added) msg.zones_added.forEach(e => zones[e.zone_id] = e);
                if (msg.zones_changed) msg.zones_changed.forEach(e => zones[e.zone_id] = e);
                // v.$set('zones', v.zones);
                // console.log("Zones Change: ", JSON.stringify(zones));
                wss.clients.forEach(function each(client) {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify(zones));
                    }
                });
            }
        });
        // refresh_browse();
    },
    core_unpaired: function (core_) {
        core = undefined;
    }
});
roon.init_services({
    required_services:   [ RoonApiBrowse, RoonApiTransport, RoonApiImage ],
});

roon.start_discovery();


const http = require("http");
const url = require("url");

const imageListener = function (req, res) {

    const query = url.parse(req.url, true).query;
    console.log("image key requested:", query, typeof req.url);

    core.services.RoonApiImage.get_image(
        query.image_key,
        { scale: "fit", width: 1080, height: 1080, format: "image/jpeg" },
        function(cb, contentType, body) {
            console.log("image response:", cb, contentType, body);
            res.contentType = contentType;
            res.writeHead(200, { "Content-Type": "image/jpeg" });
            res.end(body, "binary");
        }
    );
};
const server = http.createServer(imageListener);
server.listen(9070, '0.0.0.0', () => {
    console.log(`Server is running`);
});
