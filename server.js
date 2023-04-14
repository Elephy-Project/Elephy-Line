/**
 * This is the main Node.js server script for your project
 * Check out the two endpoints this back-end API provides in fastify.get and fastify.post below
 */

const path = require("path");
const axios = require("axios");
const channelToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const REPEAT = 20000;

// Require the fastify framework and instantiate it
const fastify = require("fastify")({
  // Set this to true for detailed logging:
  logger: true,
});

// ADD FAVORITES ARRAY VARIABLE FROM TODO HERE

// Setup our static files
fastify.register(require("@fastify/static"), {
  root: path.join(__dirname, "public"),
  prefix: "/", // optional: default '/'
});

// Formbody lets us parse incoming forms
fastify.register(require("@fastify/formbody"));

// View is a templating manager for fastify
fastify.register(require("@fastify/view"), {
  engine: {
    handlebars: require("handlebars"),
  },
});

// Load and parse SEO data
const seo = require("./src/seo.json");
if (seo.url === "glitch-default") {
  seo.url = `https://${process.env.PROJECT_DOMAIN}.glitch.me`;
}

/**
 * Our home page route
 *
 * Returns src/pages/index.hbs with data built into it
 */
fastify.get("/", function (request, reply) {
  // params is an object we'll pass to our handlebars template
  let params = { seo: seo };

  // If someone clicked the option for a random color it'll be passed in the querystring
  if (request.query.randomize) {
    // We need to load our color data file, pick one at random, and add it to the params
    const colors = require("./src/colors.json");
    const allColors = Object.keys(colors);
    let currentColor = allColors[(allColors.length * Math.random()) << 0];

    // Add the color properties to the params object
    params = {
      color: colors[currentColor],
      colorError: null,
      seo: seo,
    };
  }

  // The Handlebars code will be able to access the parameter values and build them into the page
  return reply.view("/src/pages/index.hbs", params);
});

/**
 * Our POST route to handle and react to form submissions
 *
 * Accepts body data indicating the user choice
 */
fastify.post("/", function (request, reply) {
  // Build the params object to pass to the template
  let params = { seo: seo };

  // If the user submitted a color through the form it'll be passed here in the request body
  let color = request.body.color;

  // If it's not empty, let's try to find the color
  if (color) {
    // ADD CODE FROM TODO HERE TO SAVE SUBMITTED FAVORITES

    // Load our color data file
    const colors = require("./src/colors.json");

    // Take our form submission, remove whitespace, and convert to lowercase
    color = color.toLowerCase().replace(/\s/g, "");

    // Now we see if that color is a key in our colors object
    if (colors[color]) {
      // Found one!
      params = {
        color: colors[color],
        colorError: null,
        seo: seo,
      };
    } else {
      // No luck! Return the user value as the error property
      params = {
        colorError: request.body.color,
        seo: seo,
      };
    }
  }

  // The Handlebars template will use the parameter values to update the page with the chosen color
  return reply.view("/src/pages/index.hbs", params);
});

// Run the server and report out to the logs
fastify.listen(
  { port: process.env.PORT, host: "0.0.0.0" },
  function (err, address) {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    console.log(`Your app is listening on ${address}`);
  }
);

// connect to line Elephy
fastify.post("/elephy-line", function (request, reply) {
  for (const event of request.body.events) {
    if (event.type === "message" && event.message.type === "location") {
      try {
        const response = axios
          .post(`${process.env.BASE_PATH}/record`, {
            informant: "Line user",
            location_lat: event.message.latitude,
            location_long: event.message.longitude,
          })
          .then((response) => {
            return response.status;
          });
      } catch (error) {
        console.log(error);
      }

      try {
        const lineRes = axios.post(
          "https://api.line.me/v2/bot/message/reply",
          {
            replyToken: event.replyToken,
            messages: [{ type: "text", text: "Thank you for your report." }],
          },
          {
            headers: {
              authorization: `Bearer ${channelToken}`,
            },
          }
        );
      } catch (error) {
        console.log(error);
      }
    } else if (
      event.type === "message" &&
      event.message.type === "text" &&
      event.message.text.toLowerCase() === "history"
    ) {
      try {
        axios.post(
          "https://api.line.me/v2/bot/message/reply",
          {
            replyToken: event.replyToken,
            messages: [
              { type: "text", text: "https://elephy.vercel.app/summary" },
            ],
          },
          {
            headers: {
              authorization: `Bearer ${channelToken}`,
            },
          }
        );
      } catch (error) {
        console.log(error);
      }
    } else if (
      event.type === "message" &&
      event.message.type === "text" &&
      event.message.text.toLowerCase() === "today records"
    ) {
      try {
        const recordsResponse = axios
          .get(`${process.env.BASE_PATH}/elephant-records`)
          .then((response) => {
            return response.data;
          });
      } catch (error) {
        console.log(error);
      }
    } else {
      try {
        axios.post(
          "https://api.line.me/v2/bot/message/reply",
          {
            replyToken: event.replyToken,
            messages: [
              {
                type: "text",
                text: `Please share location if you detect the elephants or clict the menu/type "History" to see the history`,
              },
            ],
          },
          {
            headers: {
              authorization: `Bearer ${channelToken}`,
            },
          }
        );
      } catch (error) {
        console.log(error);
      }
    }
  }
  return "Success";
});

async function defineRecords() {
  try {
    const records = await axios
      .get(`${process.env.BASE_PATH}/elephant-records`)
      .then((response) => {
        return response.data;
      });
    console.log(records)
    const now = new Date();
    now.setMinutes(now.getMinutes() - 5);
    console.log('now', now)
    const listRecord = records.filter(
      (record) => new Date(record.datetime) >= now
    );
    let locationList = [
      {
        type: "text",
        text: "Elephant detected",
      },
    ];

    listRecord.map((record) => {
      if (locationList.length < 5) {
        const temp = {
          type: "location",
          title: "Elephant location",
          address: "Elephant address",
          latitude: record.location_lat,
          longitude: record.location_long,
        };
        locationList.push(temp);
      }
    });
    
    if (listRecord.length < 5) {
      try {
        const t = await axios.post(
          "https://api.line.me/v2/bot/message/broadcast",
          {
            messages: locationList,
          },
          {
            headers: {
              authorization: `Bearer ${channelToken}`,
            },
          }
        );
        console.log("t", t);
      } catch (error) {
        console.log(error);
      }
    }
  } catch (error) {
    console.log(error);
  }
}

setInterval(defineRecords, 300000);
