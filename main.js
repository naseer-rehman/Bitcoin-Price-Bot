console.log("Running bot");
require("dotenv").config();
const Discord = require("discord.js");
let config = require("./config.json");
const https = require("https");
const fs = require("fs");
const client = new Discord.Client();
const BITCOIN_API_URL = "https://api.coindesk.com/v1/bpi/currentprice.json";
const CURRENCY_API_URL = `https://free.currconv.com/api/v7/convert?q=USD_CAD&compact=ultra&apiKey=${process.env.CURRENCY_CONVERTER_TOKEN}`;

client.login(process.env.BOT_TOKEN);

let botPresenceData = {
    status: "online",
    activity: {
        name: "BTC-CAD: ",
        type: "PLAYING"
    },
    afk: false
};

/**
 * Properly formats a string of the form "\d+.\d+"
 * to be "\$\d+.\d+".
 * @param {String} str 
 * @returns {String}
 */
function formatMoneyString(str) {
    let decimalIndex = str.search(".");
    if (decimalIndex == -1) {
        return "$--.--";
    } else {
        let halves = str.split(".");
        return `$${halves[0]}.${halves[1].substring(0, 2)}`;
    }
}


/**
 * Obtains the exchange rate from USD to CAD.
 */
 function fetchUSDtoCADExchangeRate() {
    return new Promise((resolve, reject) => {
        https.get(CURRENCY_API_URL, (res) => {
            let data = "";
            res.on("data", (chunk) => {
                data += chunk;
            });
            res.on("end", () => {
                data = JSON.parse(data);
                config.LAST_USD_TO_CAD_RATE = data.USD_CAD;
                fs.writeFile("config.json", JSON.stringify(config), "utf8", (err) => {
                    if (err) {
                        console.log("Error updating exchange rate value:" + err);
                    }
                });
                resolve();
            });
        }).on("error", () => {
            resolve();
        });
    });
}


/**
 * Obtains the current price of bitcoin in CAD.
 * @returns {Promise}
 */
function fetchBitcoinPrice() {
    return new Promise((resolve, reject) => {
        https.get(BITCOIN_API_URL, (res) => {
            let data = "";
    
            res.on("data", (chunk) => {
                data += chunk;
            });
    
            res.on("end", () => {
                data = JSON.parse(data);
                fetchUSDtoCADExchangeRate().then(() => {
                    resolve((data.bpi.USD.rate_float * config.LAST_USD_TO_CAD_RATE).toString());
                });
            });
        }).on("error", (err) => {
            reject("error");
        });
    });
}


/**
 * Updates the bot's status to reflect the updated price 
 * of bitcoin.
 * @param {String} status 
 */
function updateBotStatusMessage(status) {
    botPresenceData.activity.name = status;
    client.user.setPresence(botPresenceData);
}

/**
 * Updates the bot's nickname in every server to reflect the updated
 * price of bitcoin.
 * @param {String} name 
 */
function updateBotNickname(name) {
    for (let [guildID, guild] of client.guilds.cache) {
        guild.member(client.user).setNickname(name);
    }
}

/**
 * A single update.
 */
function updateBot() {
    let newPrice = fetchBitcoinPrice();
    newPrice.then((price) => {
        price = formatMoneyString(price);
        let statusMessage = `BTC-CAD: ${price}`;
        let nick = `BTC: ${price.split(".")[0]} (CAD)`;
        updateBotStatusMessage(statusMessage);
        updateBotNickname(nick);
    });
}


client.on("ready", () => {
    updateBot();

    client.setInterval(updateBot, config.UPDATE_INTERVAL);
});