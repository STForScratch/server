let BANNED_USERS = JSON.parse(process.env.banned)

const { WebhookClient, EmbedBuilder } = require("discord.js");
const webhookClient = new WebhookClient({
  url: process.env.webhook,
});

const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const express = require("express");
const path = require("path");
var bodyParser = require("body-parser");
var jsonParser = bodyParser.json();
app = express();

let Vibrant = require("node-vibrant");
let START_TIME = 1677052800000

const PRIVATE_KEY = atob(process.env.github);
const APP_ID = "284321";
const INSTALLATION_ID = "33371842";

const { App } = require("octokit");

const authApp = new App({
  appId: APP_ID,
  privateKey: PRIVATE_KEY,
  request: { fetch },
});

async function commentOnIssue(issue, body) {
  const octokit = await authApp.getInstallationOctokit(INSTALLATION_ID);

  await octokit.request(
    "POST /repos/STForScratch/ScratchTools/issues/" + issue + "/comments",
    {
      owner: "STForScratch",
      repo: "ScratchTools",
      issue_number: issue,
      body,

      headers: {
        "x-github-api-version": "2022-11-28",
      },
    }
  );
}

app.post("/comment/", jsonParser, async function (req, res) {
  if (req.body.server === process.env.server) {
    commentOnIssue(req.body.issue.toString(), req.body.content.toString());
    res.send({
      success: true,
    });
  }
});

app.get("/index.js", function (req, res) {
  res.send({
    error: "nope",
  });
});

const PORT = 3000;
const cookieParser = require("cookie-parser");
app.engine("html", require("ejs").renderFile);
app.set("view engine", "html");
app.set("views", __dirname);

const cors = require("cors");
app.use(cors());

function makeId(length) {
  var result = "";
  var characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  var charactersLength = characters.length;
  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { resolveSoa } = require("dns");
const uri = process.env.db;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});
client.connect();

var newTheme = {
  title: "Late Sunset",
  author: "ScratchTools",
  theme: "dark",
  colors: {
    gradient: ["#FF4500", "#FFA64D"],
    theme: "#FF4500",
    background: "#1A1A1A",
    primary: "#FFFFFF",
    secondary: "#FFFFFF77",
    searchbar: "#383838",
    feature: "#79797933",
    slider: "#FFFFFF33",
    scrollbar_active: "#FF4500",
    scrollbar: "#FF4500CC",
    input: "#FFFFFF33",
    box: "#383838B3",
  },
};
// client.db("themes").collection("settings").insertOne(newTheme);

const http = require("http");
var WebSocketServer = require("ws").Server;
const httpserver = http.Server(app);

var events = [];
var wss = new WebSocketServer({ server: httpserver });
var connections = [];
wss.on("connection", function (ws) {
  connections.push({
    socket: ws,
    user: null,
    time: Date.now(),
  });
  var isScatt = false;
  ws.send(JSON.stringify({ connected: true }));
  ws.on("message", async function (msg) {
    msg = JSON.parse(msg);
    if (isScatt) {
      connections
        .filter((el) => el.user === msg.user)
        .forEach(function (el) {
          el.socket.send(
            JSON.stringify({
              message: msg.content,
            })
          );
        });
    } else {
      var found = connections.find((el) => el.socket === ws);
      if (found.user) {
        if (msg.type === "send") {
          events.push({
            message: msg.content,
            user: found.user,
            type: "message",
          });
        }
      } else {
        if (
          msg.type === "verify" &&
          msg.token &&
          typeof msg.features === "string" &&
          msg.version
        ) {
          var token = await client.db("verify").collection("tokens").findOne({
            expired: false,
            code: msg.token,
          });
          if (token) {
            found.user = token.user;
            var features = await (
              await fetch(
                "https://raw.githubusercontent.com/STForScratch/ScratchTools/main/features/features.json"
              )
            ).json();
            var enabled = [];
            features.forEach(function (el) {
              if (msg.features.includes(el.file || el.id)) {
                enabled.push(el.file || el.id);
              }
            });
            enabled = enabled.sort();
            var already = await client
              .db("features")
              .collection("saved")
              .findOne({
                data: enabled,
              });
            if (already) {
              enabled = already.code;
            } else {
              var code = makeId(50);
              await client.db("features").collection("saved").insertOne({
                code: code,
                data: enabled,
              });
              enabled = code;
            }
            events.push({
              user: token.user,
              type: "join",
              features: enabled,
              version: msg.version,
            });
            await client
              .db("verify")
              .collection("tokens")
              .updateOne(
                {
                  expired: false,
                  code: msg.token,
                },
                {
                  $set: {
                    expired: true,
                  },
                },
                {
                  upsert: true,
                }
              );
            ws.send(
              JSON.stringify({
                type: "message",
                content: `Hey, ${token.user}! Welcome to the ScratchTools support chat. We'd love to help you out with ScratchTools, what do you need? Heads up- we don't always have specialists online. If you can't get the help you need, try some of the other support options.`,
              })
            );
          } else {
            ws.send(
              JSON.stringify({
                error: "Authentication failed.",
                endOfWorld: true,
              })
            );
          }
        }
      }
    }
  });
  ws.on("close", function () {
    events.push({
      user: connections.find((el) => el.socket === ws).user,
      type: "leave",
    });
    var found = connections.find((el) => el.socket === ws);
    found = {};
  });
});

app.get("/messages/:user/count/", async function (req, res) {
  var messages = await client
    .db("messages")
    .collection("feedback")
    .find({
      username: req.params.user.toLowerCase(),
      unread: true,
    })
    .toArray();
  res.send({ count: messages.length });
});

let recentUninstalls = [];

app.post("/uninstall/", jsonParser, async function (req, res) {
  if (req.body.server === process.env.server) {
    if (
      !recentUninstalls.find(
        (u) => u.ip === req.body.ip && u.time > Date.now() - 43200000
      )
    ) {
      recentUninstalls.push({
        ip: req.body.ip,
        time: Date.now(),
      });
      let embed = new EmbedBuilder()
        .setTitle("Uninstall")
        .setDescription("A user has uninstalled ScratchTools.")
        .addFields(
          {
            name: "Username (Not Verified)",
            value: req.body.username || "Unknown Username",
            inline: false,
          },
          {
            name: "Installed",
            value: `<t:${req.body.timeInstalled
                ? Math.round(Number(req.body.timeInstalled) / 1000).toString()
                : "Unknown Time"
              }>`,
            inline: false,
          },
          {
            name: "Features Enabled Code",
            value: "`" + (req.body.features || "Unknown") + "`",
            inline: false,
          },
          {
            name: "Version",
            value: "`" + (req.body.version || "") + "`",
            inline: false,
          }
        );
      webhookClient.send({
        username: "ScratchTools Webserver Moderation",
        avatarURL:
          "https://raw.githubusercontent.com/STForScratch/ScratchTools/main/extras/icons/beta/beta128.png",
        embeds: [embed],
        threadId: "1191067778761883769",
      });
    }
    res.send({
      success: true,
    });
  }
});

app.post("/get-messages/", jsonParser, async function (req, res) {
  if (req.body.token) {
    var token = await client.db("verify").collection("tokens").findOne({
      expired: false,
      code: req.body.token,
    });
    if (token) {
      var messages = await client
        .db("messages")
        .collection("feedback")
        .find({
          username: token.user.toLowerCase(),
        })
        .toArray();
      await client
        .db("messages")
        .collection("feedback")
        .updateMany(
          {
            username: token.user.toLowerCase(),
            unread: true,
          },
          {
            $set: {
              unread: false,
            },
          },
          {
            upsert: false,
          }
        );
      res.send(messages);
    } else {
      res.send({
        error: "Token not found.",
      });
    }
  } else {
    res.send({
      error: "Token not found.",
    });
  }
});

app.post("/verified-feedback/", jsonParser, async function (req, res) {
  if (
    req.body.useragent &&
    typeof req.body.useragent === "string" &&
    req.body.settings &&
    typeof req.body.settings === "string" &&
    req.body.token &&
    typeof req.body.token &&
    req.body.feedback &&
    typeof req.body.feedback &&
    req.body.version &&
    typeof req.body.version === "string"
  ) {
    var token = await client.db("verify").collection("tokens").findOne({
      expired: false,
      code: req.body.token,
    });
    if (token) {
      req.body.username = token.user;
      var embed = new EmbedBuilder()
        .setTitle("New Feedback")
        .setDescription("Feedback has been received via the extension.")
        .addFields(
          {
            name: "Username (Verified)",
            value: req.body.username,
            inline: false,
          },
          {
            name: "Feedback",
            value: req.body.feedback,
            inline: false,
          },
          {
            name: "Version",
            value: "`" + req.body.version + "`",
            inline: false,
          },
          {
            name: "Useragent",
            value: "`" + req.body.useragent + "`",
            inline: false,
          },
          {
            name: "Features Enabled Code",
            value: "`" + req.body.settings + "`",
            inline: false,
          }
        );
      webhookClient.send({
        username: "ScratchTools Webserver Moderation",
        avatarURL:
          "https://raw.githubusercontent.com/STForScratch/ScratchTools/main/extras/icons/beta/beta128.png",
        embeds: [embed],
        threadId: "1191073295014035516",
      });
      res.send({
        success: true,
      });
    } else {
      res.send({
        error: "Invalid token.",
      });
    }
  } else {
    res.send({
      error: "Missing parameters.",
    });
  }
});

app.get("/tutorials/", async function (req, res) {
  res.send([
    {
      title: "Create a Multiplayer Game",
      description:
        "Make a multiplayer cloud game, where Scratchers can play together!",
      id: "1JTgg4WVAX8",
    },
    {
      title: "Make a Platformer",
      description:
        "Platformers are very popular on Scratch, now you can make your own!",
      id: "aUmXJJww7KE",
    },
    {
      title: "Geometry Dash",
      description:
        "Make your very own Geometry Dash game using the Scratch editor!",
      id: "FYZ1bfB1nho",
    },
    {
      title: "Flappy Bird",
      description: "Learn how to make the classic Flappy Bird game on Scratch!",
      id: "Rg_UIn5vii8",
    },
  ]);
});

app.get("/projects/:id/", async function (req, res) {
  let data = await (
    await fetch(process.env.api_server + `/projects/${req.params.id}/`)
  ).json();
  if (data.error) {
    res.send({ error: "project not found" });
  } else {
    res.send(data);
  }
});

app.post("/message/", jsonParser, async function (req, res) {
  if (req.body.secret === process.env.server) {
    if (req.body.user && req.body.message) {
      await client.db("messages").collection("feedback").insertOne({
        username: req.body.user.toLowerCase(),
        message: req.body.message,
        unread: true,
        time: Date.now(),
      });
      res.send({
        success: true,
      });
    } else {
      res.send("Missing data.");
    }
  } else {
    res.send({
      error: "Invalid secret.",
    });
  }
});

app.post("/support/", jsonParser, async function (req, res) {
  if (req.body.secret === process.env.server) {
    if (req.body.type === "message" && req.body.user && req.body.content) {
      var sockets = connections.filter((el) => el.user === req.body.user);
      if (sockets.length !== 0) {
        sockets.forEach(function (socket) {
          try {
            socket.socket?.send(
              JSON.stringify({
                type: "message",
                content: req.body.content,
              })
            );
          } catch (err) { }
        });
        res.send({
          success: true,
        });
      } else {
        res.send({
          error: "Socket not found.",
        });
      }
    } else if (req.body.type === "special-message" && req.body.user && req.body.content) {
      var sockets = connections.filter((el) => el.user === req.body.user);
      if (sockets.length !== 0) {
        sockets.forEach(function (socket) {
          try {
            socket.socket?.send(
              JSON.stringify({
                type: "special-message",
                content: req.body.content,
                id: req.body.id,
                options: req.body.options,
              })
            );
          } catch (err) { }
        });
        res.send({
          success: true,
        });
      } else {
        res.send({
          error: "Socket not found.",
        });
      }
    } else if (req.body.user && req.body.type === "disableAll") {
      var sockets = connections.filter((el) => el.user === req.body.user);
      if (sockets.length !== 0) {
        sockets.forEach(function (socket) {
          try {
            socket.socket?.send(
              JSON.stringify({
                type: "setFeatures",
                features: "",
              })
            );
          } catch (err) { }
        });
        res.send({
          success: true,
        });
      } else {
        res.send({
          error: "Socket not found.",
        });
      }
    } else if (
      req.body.user &&
      req.body.code &&
      req.body.type === "resetFeatures"
    ) {
      var found = await client.db("features").collection("saved").findOne({
        code: req.body.code,
      });
      if (found) {
        var sockets = connections.filter((el) => el.user === req.body.user);
        if (sockets.length !== 0) {
          sockets.forEach(function (socket) {
            try {
              socket.socket?.send(
                JSON.stringify({
                  type: "setFeatures",
                  features: found.data.join("."),
                })
              );
            } catch (err) { }
          });
          res.send({
            success: true,
          });
        } else {
          res.send({
            error: "Socket not found.",
          });
        }
      } else {
        res.send({
          error: "Code not found.",
        });
      }
    } else if (req.body.user && req.body.type === "reload") {
      var sockets = connections.filter((el) => el.user === req.body.user);
      if (sockets.length !== 0) {
        sockets.forEach(function (socket) {
          try {
            socket.socket?.send(
              JSON.stringify({
                type: "reload",
              })
            );
          } catch (err) { }
        });
        res.send({
          success: true,
        });
      } else {
        res.send({
          error: "Socket not found.",
        });
      }
    } else if (req.body.user && req.body.type === "download") {
      var sockets = connections.filter((el) => el.user === req.body.user);
      if (sockets.length !== 0) {
        sockets.forEach(function (socket) {
          try {
            socket.socket?.send(
              JSON.stringify({
                type: "downloadSettings",
              })
            );
          } catch (err) { }
        });
        res.send({
          success: true,
        });
      } else {
        res.send({
          error: "Socket not found.",
        });
      }
    }
  }
});

app.get("/themes/scratchtools/", async function (req, res) {
  var themes = await client
    .db("themes")
    .collection("settings")
    .find({})
    .toArray();
  res.send(themes);
});

app.get("/color/", async function (req, res) {
  if (req.query.img) {
    var rgb = null;
    try {
      let colors = await Vibrant.from(req.query.img).getPalette();
      rgb = `rgb(${colors.Vibrant._rgb[0].toString()}, ${colors.Vibrant._rgb[1].toString()}, ${colors.Vibrant._rgb[2].toString()})`;
    } catch (err) {
      console.log(err);
      rgb = "white";
    }
    res.send({
      rgb,
    });
  }
});

app.get("/events/:code/", function (req, res) {
  if (req.params.code === process.env.server) {
    res.send(events);
    events = [];
  } else {
    res.send([]);
  }
});

app.get("/connections/", function (req, res) {
  res.send(connections);
});

app.get("/", async function (req, res) {
  res.send("Currently running.");
});

app.get("/latest/", function (req, res) {
  res.send({
    version: "3.1.0-beta",
    beta: 4,
  });
});

app.get("/isbeta/:username/", async function (req, res) {
  var user = await client.db("beta").collection("users").findOne({
    username: req.params.username.toLowerCase(),
  });
  if (user?.beta) {
    res.send({
      beta: true,
    });
  } else {
    res.send({
      beta: false,
    });
  }
});

app.get("/trending/", function (req, res) {
  res.send([
    "comment-on-closed-profile",
    "pause-audio",
    "scroll-project-titles",
    "sprite-clones",
    "message-count",
    "collapse-blocks",
    "colored-comments",
    "forum-scratch-team",
    "special-editor-fonts",
    "statistics",
    "stats-percentages",
    "isonline",
    "get-project-tags",
    "project-timer",
    "scrollable-list-items",
    "admin-notifications",
  ]);
});

app.get("/news/", async function (req, res) {
  res.send({
    title: "We want to know your favorite feature!",
    description:
      "If you want to be featured in a ScratchTools YouTube video, either submit feedback here or open a support ticket using the buttons below and tell us your favorite feature!",
  });
});

app.get("/get-token/", async function (req, res) {
  if (
    ObjectId.isValid(req.query.secret) &&
    req.query.server === process.env.server
  ) {
    var token = await client
      .db("beta")
      .collection("tokens")
      .findOne({
        _id: new ObjectId(req.query.secret),
      });
    if (token && !token.grabbed) {
      await client
        .db("beta")
        .collection("tokens")
        .updateOne(
          {
            _id: new ObjectId(req.query.secret),
          },
          {
            $set: {
              grabbed: true,
            },
          },
          {
            upsert: true,
          }
        );
      res.send({
        token: token.token,
        user: token.user,
      });
    } else {
      res.send({
        error: "Authentication failed.",
      });
    }
  }
});

app.get("/beta-joined/", async function (req, res) {
  if (req.query.privateCode) {
    fetch(
      `https://auth.itinerary.eu.org/api/auth/verifyToken?privateCode=${req.query.privateCode}`,
      { method: "GET" }
    )
      .then((response) => response.json())
      .then(async function (data) {
        if (
          data.valid === true &&
          data.redirect === "https://data.scratchtools.app/beta-joined/"
        ) {
          var user = await client.db("beta").collection("users").findOne({
            username: data.username.toLowerCase(),
          });
          var secret = makeId(150);
          var token = await client.db("beta").collection("tokens").insertOne({
            user: data.username,
            token: secret,
            time: Date.now(),
            grabbed: false,
          });
          if (!user?.beta) {
            webhookClient.send({
              username: "ScratchTools Webserver Moderation (Web Feedback)",
              content: `🧪 @${data.username} just joined the ScratchTools beta program.`,
              avatarURL:
                "https://raw.githubusercontent.com/STForScratch/ScratchTools/main/extras/icons/beta/beta128.png",
            });
          }
          await client
            .db("beta")
            .collection("users")
            .updateOne(
              {
                username: data.username.toLowerCase(),
              },
              {
                $set: {
                  username: data.username.toLowerCase(),
                  beta: true,
                },
              },
              {
                upsert: true,
              }
            );
          res.redirect(
            "https://scratchtools.zip/joined/?code=" + token.insertedId
          );
        } else {
          res.send("Scratch verification failed.");
        }
      });
  } else {
    res.send("Scratch verification failed.");
  }
});

app.post("/create/", jsonParser, async function (req, res) {
  if (req.body.features && typeof req.body.features === "string") {
    const features = await (
      await fetch(
        "https://raw.githubusercontent.com/STForScratch/ScratchTools/main/features/features.json"
      )
    ).json();
    var enabled = [];
    features.forEach(function (el) {
      if (req.body.features.includes(el.file || el.id)) {
        enabled.push(el.file || el.id);
      }
    });
    enabled = enabled.sort();
    var already = await client.db("features").collection("saved").findOne({
      data: enabled,
    });
    if (already) {
      res.send({
        code: already.code,
      });
    } else {
      var code = makeId(50);
      await client.db("features").collection("saved").insertOne({
        code: code,
        data: enabled,
      });
      res.send({
        code: code,
      });
    }
  } else {
    res.send({
      error: "Features not specified.",
    });
  }
});

app.post("/web-feedback/", jsonParser, async function (req, res) {
  if (
    req.body.useragent &&
    typeof req.body.useragent === "string" &&
    req.body.username &&
    typeof req.body.username &&
    req.body.feedback &&
    typeof req.body.feedback
  ) {
    var embed = new EmbedBuilder()
      .setTitle("New Feedback")
      .setDescription("Feedback has been received via the website.")
      .addFields(
        {
          name: "Username",
          value: req.body.username,
          inline: false,
        },
        {
          name: "Feedback",
          value: req.body.feedback,
          inline: false,
        },
        {
          name: "Useragent",
          value: "`" + req.body.useragent + "`",
          inline: false,
        }
      );
    webhookClient.send({
      username: "ScratchTools Webserver Moderation (Web Feedback)",
      avatarURL:
        "https://raw.githubusercontent.com/STForScratch/ScratchTools/main/extras/icons/beta/beta128.png",
      embeds: [embed],
      threadId: "1191073295014035516",
    });
    res.send({
      success: true,
    });
  } else {
    res.send({
      error: "Missing parameters.",
    });
  }
});

app.post("/feedback/", jsonParser, async function (req, res) {
  if (
    req.body.useragent &&
    typeof req.body.useragent === "string" &&
    req.body.settings &&
    typeof req.body.settings === "string" &&
    req.body.username &&
    typeof req.body.username &&
    req.body.feedback &&
    typeof req.body.feedback &&
    req.body.version &&
    typeof req.body.version === "string"
  ) {
    var embed = new EmbedBuilder()
      .setTitle("New Feedback")
      .setDescription("Feedback has been received via the extension.")
      .addFields(
        {
          name: "Username",
          value: req.body.username,
          inline: false,
        },
        {
          name: "Feedback",
          value: req.body.feedback,
          inline: false,
        },
        {
          name: "Version",
          value: "`" + req.body.version + "`",
          inline: false,
        },
        {
          name: "Useragent",
          value: "`" + req.body.useragent + "`",
          inline: false,
        },
        {
          name: "Features Enabled Code",
          value: "`" + req.body.settings + "`",
          inline: false,
        }
      );
    webhookClient.send({
      username: "ScratchTools Webserver Moderation",
      avatarURL:
        "https://raw.githubusercontent.com/STForScratch/ScratchTools/main/extras/icons/beta/beta128.png",
      embeds: [embed],
      threadId: "1191073295014035516",
    });
    res.send({
      success: true,
    });
  } else {
    res.send({
      error: "Missing parameters.",
    });
  }
});

const { OpenAI } = require("openai");

const openai = new OpenAI({
  apiKey: process.env.openai,
});

let ALL_AI_REQUESTS = [];
let FAILED_RESPONSES = [
  "Sorry, but you've been ratelimited. You can try asking Scatt AI more questions later, but please wait a moment.",
  "You've been talking a lot to Scatt AI, and he got tired. Please wait a little while before continuing.",
  "Sorry, but Scatt AI had to take a break. You can ask more questions again in a little bit.",
];

app.post("/ai-query/", jsonParser, async function (req, res) {
  let requests = ALL_AI_REQUESTS.filter(
    (rq) =>
      (rq.time > Date.now() - 600000 * 2 &&
        rq.ip === req.headers["x-forwarded-for"]) ||
      req.socket.remoteAddress
  );
  if (requests.length >= 10) {
    res.send({
      success: true,
      response:
        FAILED_RESPONSES[Math.floor(Math.random() * FAILED_RESPONSES.length)],
    });
  } else {
    if (
      req.body.search &&
      typeof req.body.search === "string" &&
      req.body.username
    ) {
      let data = await getSearch(req.body.search, req.body.username);
      ALL_AI_REQUESTS.push({
        ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
        time: Date.now(),
      });
      res.send({
        success: true,
        response: data,
      });
    } else {
      res.send({
        error: "missing info",
      });
    }
  }
});

async function getSearch(searchQuery, username) {
  try {
    return new Promise(async (resolve) => {
      const thread = await openai.beta.threads.create();

      const message = await openai.beta.threads.messages.create(thread.id, {
        role: "user",
        content: searchQuery,
      });

      const run = await openai.beta.threads.runs.create(thread.id, {
        assistant_id: "asst_W9PNwqIde1bJmKgH9Vs9fkw8",
        instructions: "Please address the user as " + username + ".",
      });

      let interval = setInterval(async function () {
        let runInfo = await openai.beta.threads.runs.retrieve(
          thread.id,
          run.id
        );
        if (runInfo.status === "completed") {
          clearInterval(interval);
          const messages = await openai.beta.threads.messages.list(thread.id);

          resolve(messages.body.data[0].content[0].text?.value || "");
        } else if (runInfo.status === "requires_action") {
          runInfo.required_action.submit_tool_outputs.tool_calls.forEach(
            async function (call) {
              if (call.function.name === "get_projects") {
                let { query } = JSON.parse(call.function.arguments);
                console.log(query);
                let data = await (
                  await fetch(
                    `https://explodingstar.pythonanywhere.com/scratch/api/?endpoint=/search/projects%3Flimit=3%26offset=0%26language=en%26mode=popular%26q=${query}`
                  )
                ).json();
                data.length = 3;

                let projects = [];
                for (var i in data) {
                  projects.push({
                    name: data[i].title,
                    url: `/projects/${data[i].id}/`,
                  });
                }
                clearInterval(interval);
                resolve(projects);

                await openai.beta.threads.runs.submitToolOutputs(
                  thread.id,
                  run.id,
                  {
                    tool_outputs: [
                      {
                        tool_call_id: call.id,
                        output: `{success:true}`,
                      },
                    ],
                  }
                );
              }
            }
          );
        }
      }, 2000);
    });
  } catch (err) {
    return "An error occurred.";
  }
}

app.get("/pfp/:id/", async function (req, res) {
  try {
    const imageUrl = `https://uploads.scratch.mit.edu/get_image/user/${req.params.id}_60x60.png`;
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error("Failed to fetch image");
    }
    const buffer = await response.buffer();
    res.writeHead(200, {
      "Content-Type": response.headers.get("content-type"),
      "Content-Length": buffer.length,
    });
    res.end(buffer);
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/submission/", async function (req, res) {
  res.redirect("https://youtu.be/sGfxaLhyQIs")
  return;
  if (Date.now() > 1705237200000) {
    let SERVER_URL = "https://data.scratchtools.app";
    if (req.query.privateCode) {
      let data = await (
        await fetch(
          `https://auth.itinerary.eu.org/api/auth/verifyToken?privateCode=${req.query.privateCode}`
        )
      ).json();
      if (data.valid) {
        let token = makeId(100);
        await client.db("verify").collection("tokens").insertOne({
          time: Date.now(),
          user: data.username,
          code: token,
          expired: false,
        });
        let selected = await client.db("awards").collection("submissions-23").findOne({
          user: data.username,
        })
        res.render(path.join(__dirname, "/submission.html"), {
          token,
          username: data.username,
          selected: selected?.project || "",
        });
      } else {
        res.redirect(
          `https://auth.itinerary.eu.org/auth/?redirect=${btoa(
            SERVER_URL + "/submission/"
          )}&name=ScratchTools`
        );
      }
    } else {
      res.redirect(
        `https://auth.itinerary.eu.org/auth/?redirect=${btoa(
          SERVER_URL + "/submission/"
        )}&name=ScratchTools`
      );
    }
  } else {
    res.sendFile(path.join(__dirname, "/closed.html"))
  }
});

app.post("/submit-project/", jsonParser, async function (req, res) {
  if (Date.now() > 1705237200000) {
    if (req.body.token && req.body.project) {
      try {
        let data = await (await fetch(`https://trampoline.turbowarp.org/api/projects/${req.body.project}/`)).json()
        if (data.title !== undefined) {
          if (new Date(data.history.shared).getTime() > START_TIME) {
            let token = await client.db("verify").collection("tokens").findOne({
              expired: false,
              code: req.body.token,
            });
            if (token) {
              if (token.user === data.author.username) {
                await client.db("awards").collection("submissions-23").updateOne({
                  user: data.author.username,
                },
                  {
                    $set: {
                      project: data.id.toString(),
                      user: data.author.username,
                      time: Date.now(),
                    }
                  },
                  {
                    upsert: true,
                  })
                res.send({
                  success: true,
                })
              } else {
                res.send({
                  error: "Project does not belong to you."
                })
              }
            } else {
              res.send({
                error: "Not logged in."
              })
            }
          } else {
            res.send({
              error: "Project is too old."
            })
          }
        } else {
          res.send({
            error: "Project is not shared."
          })
        }
      } catch (err) {
        res.send({
          error: "An error occurred."
        })
      }
    } else {
      res.send({
        error: "Missing token or project."
      })
    }
  }
})

app.get("/user-projects/:user/", async function (req, res) {
  let projects = await getProjects(req.params.user)
  res.send(projects)
})

async function getProjects(user) {
  let projects = [];
  let offset = 0;
  let keepGoing = true;

  while (keepGoing) {
    let data = await (
      await fetch(
        `https://explodingstar.pythonanywhere.com/scratch/api/?endpoint=/users/${user}/projects?offset=${offset.toString()}`
      )
    ).json();
    data = data.filter(
      (el) => new Date(el.history.shared).getTime() > START_TIME
    );
    projects.push(...data);
    offset += 20;
    if (data.length !== 20) {
      keepGoing = false;
    }
  }

  return projects;
}

app.get("/project/:id/", async function (req, res) {
  let data = await (
    await fetch(
      `https://trampoline.turbowarp.org/api/projects/${req.params.id}/`
    )
  ).json();
  res.send(data);
});

app.post("/online/", jsonParser, async function (req, res) {
  if (req.body.user && typeof req.body.user === "string") {
    try {
      var userData = await (
        await fetch(
          `https://trampoline.turbowarp.org/api/users/${req.body.user}/`
        )
      ).json();
    } catch (err) {
      var userData = {
        username: req.body.user,
      };
    }
    if (userData?.username) {
      var found = await client.db("isonline").collection("users").findOne({
        username: userData.username,
      });
      if (found) {
        await client
          .db("isonline")
          .collection("users")
          .updateOne(
            {
              username: userData.username,
            },
            {
              $set: {
                lastOnline: Date.now(),
              },
            },
            {
              upsert: true,
            }
          );
      } else {
        await client.db("isonline").collection("users").insertOne({
          username: userData.username,
          lastOnline: Date.now(),
        });
      }
      res.send({
        success: true,
      });
    } else {
      res.send({
        error: "User not found.",
      });
    }
  } else {
    res.send({
      error: "User not given.",
    });
  }
});

app.get("/name/:user/", async function (req, res) {
  var userData = await (
    await fetch(
      `https://trampoline.turbowarp.org/api/users/${req.params.user}/`
    )
  ).json();
  if (userData.username) {
    var found = await client.db("displaynames").collection("users").findOne({
      username: userData.username,
    });
    if (found) {
      res.send({
        username: userData.username,
        displayName: found.displayName || null,
      });
    } else {
      res.send({
        username: userData.username,
        displayName: null,
      });
    }
  } else {
    res.send({
      error: "User not found.",
    });
  }
});

function makeId(length) {
  var result = "";
  var characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  var charactersLength = characters.length;
  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

app.get("/verification/code/", async function (req, res) {
  var privateKey = makeId(150);
  const min = 100000000;
  const max = 999999999;
  var publicKey = Math.floor(Math.random() * (max - min + 1)) + min;
  await client.db("verify").collection("codes").insertOne({
    time: Date.now(),
    secret: privateKey,
    code: publicKey,
    used: false,
  });
  res.send({
    code: publicKey,
    secret: privateKey,
  });
});

app.get("/status/:username/", async function (req, res) {
  try {
    var userData = await (
      await fetch(
        `https://trampoline.turbowarp.org/api/users/${req.params.username}/`
      )
    ).json();
  } catch (err) {
    var userData = {
      username: req.params.username,
    };
  }
  if (userData?.username) {
    var found = await client.db("plus").collection("users").findOne({
      username: userData.username,
    });
    if (found) {
      res.send({
        status: found.status ? "🍀" + found.status : "🍀",
      });
    } else {
      res.send({
        status: "🍀",
      });
    }
  } else {
    res.send({
      error: "User not found.",
    });
  }
});

const { emojis } = require("./emojis.js");

app.post("/setstatus/", jsonParser, async function (req, res) {
  if (
    req.body.token &&
    typeof req.body.token === "string" &&
    req.body.status &&
    typeof req.body.status === "string"
  ) {
    if (emojis.includes(req.body.status.toString())) {
      var token = await client.db("verify").collection("tokens").findOne({
        expired: false,
        code: req.body.token,
      });
      if (token) {
        if (BANNED_USERS.includes(token.user))
          return res.send({ error: "You've been banned." });
        var found = await client.db("plus").collection("users").findOne({
          username: token.user,
        });
        if (found) {
          await client
            .db("plus")
            .collection("users")
            .updateOne(
              {
                username: token.user,
              },
              {
                $set: {
                  status: req.body.status,
                  lastUpdated: Date.now(),
                },
              },
              {
                upsert: true,
              }
            );
          webhookClient.send({
            content: `**🪪 Emoji status:** @${token.user} just set their emoji status to \`${req.body.status}\`.`,
            username: "ScratchTools Webserver Moderation",
            avatarURL:
              "https://raw.githubusercontent.com/STForScratch/ScratchTools/main/extras/icons/beta/beta128.png",
            threadId: "1191072961881444413",
          });
        } else {
          await client.db("plus").collection("users").insertOne({
            username: token.user,
            lastUpdated: Date.now(),
            status: req.body.status,
          });
          webhookClient.send({
            content: `**🪪 Emoji status:** @${token.user} just set their emoji status to \`${req.body.status}\`.`,
            username: "ScratchTools Webserver Moderation",
            avatarURL:
              "https://raw.githubusercontent.com/STForScratch/ScratchTools/main/extras/icons/beta/beta128.png",
            threadId: "1191072961881444413",
          });
        }
        res.send({
          success: true,
        });
      } else {
        res.send({
          error: "Not found.",
        });
      }
    } else {
      res.send({
        error: "Only one emoji is allowed.",
      });
    }
  } else {
    res.send({
      error: "Missing parameters.",
    });
  }
});

app.post("/setdisplay/", jsonParser, async function (req, res) {
  if (
    req.body.token &&
    typeof req.body.token === "string" &&
    req.body.name &&
    typeof req.body.name === "string"
  ) {
    var token = await client.db("verify").collection("tokens").findOne({
      expired: false,
      code: req.body.token,
    });
    if (token) {
      if (BANNED_USERS.includes(token.user))
        return res.send({ error: "You've been banned. " });
      var found = await client.db("displaynames").collection("users").findOne({
        username: token.user,
      });
      if (found) {
        if (token.user === req.body.name) {
          await client.db("displaynames").collection("users").deleteOne({
            username: token.user,
          });
          webhookClient.send({
            content: `**🪪 Display Name:** @${token.user} just deleted their display name.`,
            username: "ScratchTools Webserver Moderation",
            avatarURL:
              "https://raw.githubusercontent.com/STForScratch/ScratchTools/main/extras/icons/beta/beta128.png",
            threadId: "1191072961881444413",
          });
        } else {
          await client
            .db("displaynames")
            .collection("users")
            .updateOne(
              {
                username: token.user,
              },
              {
                $set: {
                  displayName: req.body.name,
                  lastUpdated: Date.now(),
                },
              },
              {
                upsert: true,
              }
            );
          webhookClient.send({
            content: `**🪪 Display Name:** @${token.user
              } just set their display name to \`${req.body.name
                .replaceAll("\n", " ")
                .replaceAll("`", "`")}\`.`,
            username: "ScratchTools Webserver Moderation",
            avatarURL:
              "https://raw.githubusercontent.com/STForScratch/ScratchTools/main/extras/icons/beta/beta128.png",
            threadId: "1191072961881444413",
          });
        }
      } else if (token.user !== req.body.name) {
        await client.db("displaynames").collection("users").insertOne({
          username: token.user,
          lastUpdated: Date.now(),
          displayName: req.body.name,
        });
        webhookClient.send({
          content: `**🪪 Display Name:** @${token.user
            } just set their display name to \`${req.body.name
              .replaceAll("\n", " ")
              .replaceAll("`", "`")}\`.`,
          username: "ScratchTools Webserver Moderation",
          avatarURL:
            "https://raw.githubusercontent.com/STForScratch/ScratchTools/main/extras/icons/beta/beta128.png",
          threadId: "1191072961881444413",
        });
      }
      res.send({
        success: true,
      });
    } else {
      res.send({
        error: "Not found.",
      });
    }
  } else {
    res.send({
      error: "Missing parameters.",
    });
  }
});

app.get("/pinned/:id/", async function(req, res) {
  let pinned = await client.db("pins").collection("projects").findOne({
    projectId: req.params.id,
  })

  res.send(pinned || {})
})

app.post("/pin/", jsonParser, async function (req, res) {
  try {
    if (
      req.body.token &&
      typeof req.body.token === "string" &&
      req.body.author &&
      typeof req.body.author === "string" &&
      req.body.id &&
      typeof req.body.id === "string" &&
      req.body.content &&
      typeof req.body.content === "string" &&
      req.body.project &&
      typeof req.body.project === "string"
    ) {
      var token = await client.db("verify").collection("tokens").findOne({
        expired: false,
        code: req.body.token,
      });
      if (token) {
        if (BANNED_USERS.includes(token.user))
          return res.send({ error: "You've been banned. " });
        let data = await (await fetch(`https://trampoline.turbowarp.org/api/projects/${req.body.project}/`)).json()
        if (data?.author?.username?.toLowerCase() === token.user.toLowerCase()) {
          await client.db("pins").collection("projects").updateOne({
            projectId: req.body.project,
          },
            {
              $set: {
                projectId: req.body.project,
                author: req.body.author,
                content: req.body.content,
                commentId: req.body.id,
                time: Date.now(),
              }
            },
            {
              upsert: true,
            })
          webhookClient.send({
            content: `**📌 Pinned Comment:** @${token.user
              } just pinned a new comment to their project (${req.body.project}) with the content:  \`${req.body.content
                .replaceAll("\n", " ")
                .replaceAll("`", "`")}\`.`,
            username: "ScratchTools Webserver Moderation",
            avatarURL:
              "https://raw.githubusercontent.com/STForScratch/ScratchTools/main/extras/icons/beta/beta128.png",
            threadId: "1246514851803828255",
          });
          res.send({
            success: true,
          });
        } else {
          res.send({
            error: "This project doesn't belong to you.",
          });
        }
      } else {
        res.send({
          error: "Not found.",
        });
      }
    } else {
      res.send({
        error: "Missing parameters.",
      });
    }
  } catch (err) {
    res.send({
      error: "An error occurred."
    })
  }
});

app.post("/unpin/", jsonParser, async function (req, res) {
  try {
    if (
      req.body.token &&
      typeof req.body.token === "string" &&
      req.body.project &&
      typeof req.body.project === "string"
    ) {
      var token = await client.db("verify").collection("tokens").findOne({
        expired: false,
        code: req.body.token,
      });
      if (token) {
        if (BANNED_USERS.includes(token.user))
          return res.send({ error: "You've been banned. " });
        let data = await (await fetch(`https://trampoline.turbowarp.org/api/projects/${req.body.project}/`)).json()
        if (data?.author?.username?.toLowerCase() === token.user.toLowerCase()) {
          await client.db("pins").collection("projects").deleteOne({
            projectId: req.body.project,
          })
          res.send({
            success: true,
          });
        } else {
          res.send({
            error: "This project doesn't belong to you.",
          });
        }
      } else {
        res.send({
          error: "Not found.",
        });
      }
    } else {
      res.send({
        error: "Missing parameters.",
      });
    }
  } catch (err) {
    res.send({
      error: "An error occurred."
    })
  }
});

app.get("/cloud-status/", async function (req, res) {
  res.send({
    available: false,
  });
});

app.post("/verify/", jsonParser, async function (req, res) {
  if (req.body.secret && typeof req.body.secret === "string") {
    var found = await client.db("verify").collection("codes").findOne({
      secret: req.body.secret,
    });
    if (found && !found.used) {
      await client
        .db("verify")
        .collection("codes")
        .updateOne(
          {
            secret: req.body.secret,
          },
          {
            $set: {
              used: true,
            },
          },
          {
            upsert: true,
          }
        );
      var data = await (
        await fetch(
          "https://clouddata.scratch.mit.edu/logs?projectid=854593681&limit=10&offset=0"
        )
      ).json();
      var username = null;
      for (var i in data) {
        var log = data[i];
        if (log.verb === "set_var") {
          if (log.name === "☁ verify") {
            if (log.value.toString() === found.code.toString()) {
              username = log.user;
            }
          }
        }
      }
      if (username) {
        var abc = makeId(100);
        await client.db("verify").collection("tokens").insertOne({
          time: Date.now(),
          user: username,
          code: abc,
          expired: false,
        });
        res.send({
          success: true,
          code: abc,
        });
      } else {
        res.send({
          error: "Verification failed.",
        });
      }
    } else {
      res.send({
        error: "Code not found.",
      });
    }
  } else {
    res.send({
      error: "Missing secret.",
    });
  }
});

app.get("/verify/", async function (req, res) {
  if (req.query.code) {
    let data = await (
      await fetch(
        `https://auth.itinerary.eu.org/api/auth/verifyToken?privateCode=${req.query.code}`
      )
    ).json();
    if (data.valid) {
      let token = makeId(100);
      await client.db("verify").collection("tokens").insertOne({
        time: Date.now(),
        user: data.username,
        code: token,
        expired: false,
      });
      res.send({
        success: true,
        token,
        username: data.username,
      });
    } else {
      res.send({
        error: "Authentication failed.",
      });
    }
  } else {
    res.send({
      error: "No code used.",
    });
  }
});

app.get("/all/online/", async function (req, res) {
  var all = await client
    .db("isonline")
    .collection("users")
    .find({
      lastOnline: { $gt: Date.now() - 300000 },
    })
    .toArray();
  var usernames = [];
  all.forEach(function (user) {
    usernames.push(user.username);
  });
  res.send(usernames);
});

app.get("/isonline/:username/", async function (req, res) {
  try {
    var userData = await (
      await fetch(
        `https://trampoline.turbowarp.org/api/users/${req.params.username}/`
      )
    ).json();
  } catch (err) {
    var userData = {
      username: req.params.username,
    };
  }
  if (userData?.username) {
    var found = await client.db("isonline").collection("users").findOne({
      username: userData.username,
    });
    if (found && found.lastOnline > Date.now() - 300000) {
      res.send({
        online: true,
        scratchtools: true,
      });
    } else {
      res.send({
        online: false,
        scratchtools:
          found !== null && found.lastOnline > Date.now() - 604800000,
      });
    }
  } else {
    res.send({
      error: "User not found.",
    });
  }
});

app.get("/get/:code/", async function (req, res) {
  var code = await client.db("features").collection("saved").findOne({
    code: req.params.code,
  });
  if (code) {
    res.send(code.data);
  } else {
    res.send({
      error: "Data not found.",
    });
  }
});

httpserver.listen(PORT);
