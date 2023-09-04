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

const PRIVATE_KEY = atob(process.env.github);
const APP_ID = "284321";
const INSTALLATION_ID = "33371842";

const { App } = require("octokit");

const authApp = new App({
  appId: APP_ID,
  privateKey: PRIVATE_KEY,
  request: { fetch }
});

async function commentOnIssue(issue, body) {
    const octokit = await authApp.getInstallationOctokit(INSTALLATION_ID);
    
    await octokit.request("POST /repos/STForScratch/ScratchTools/issues/"+issue+"/comments", {
        owner: "STForScratch",
        repo: "ScratchTools",
        issue_number: issue,
        body,
        
        headers: {
          "x-github-api-version": "2022-11-28",
        },
      }
    )
}

app.post("/comment/", jsonParser, async function(req, res) {
  if (req.body.server === process.env.server) {
    commentOnIssue(req.body.issue.toString(), req.body.content.toString())
    res.send({
      success: true,
    })
  }
})

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
        (u) => u.ip === req.body.ip && u.time > (Date.now() - 43200000)
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
            value: `<t:${req.body.timeInstalled?.toString() || "Unknown Time"}>`,
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

app.get("/tutorials/", async function(req, res) {
  res.send([
    {
      title: "Create a Multiplayer Game",
      description: "Make a multiplayer cloud game, where Scratchers can play together!",
      id: "1JTgg4WVAX8",
    },
    {
      title: "Make a Platformer",
      description: "Platformers are very popular on Scratch, now you can make your own!",
      id: "aUmXJJww7KE"
    },
    {
      title: "Geometry Dash",
      description: "Make your very own Geometry Dash game using the Scratch editor!",
      id: "FYZ1bfB1nho"
    },
    {
      title: "Flappy Bird",
      description: "Learn how to make the classic Flappy Bird game on Scratch!",
      id: "Rg_UIn5vii8"
    }
  ])
})

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
          } catch (err) {}
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
          } catch (err) {}
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
            } catch (err) {}
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
          } catch (err) {}
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
          } catch (err) {}
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

app.get("/trending/", function(req, res) {
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
    "admin-notifications"
  ])
})

app.get("/news/", async function(req, res) {
  res.send({
    title: "We want to know your favorite feature!",
    description: "If you want to be featured in a ScratchTools YouTube video, either submit feedback here or open a support ticket using the buttons below and tell us your favorite feature!"
  })
})

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
        status: found.status || null,
      });
    } else {
      res.send({
        status: null,
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
        await client
          .db("verify")
          .collection("tokens")
          .updateOne(
            {
              expired: false,
              code: req.body.token,
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
      await client
        .db("verify")
        .collection("tokens")
        .updateOne(
          {
            expired: false,
            code: req.body.token,
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
            content: `**🪪 Display Name:** @${
              token.user
            } just set their display name to \`${req.body.name
              .replaceAll("\n", " ")
              .replaceAll("`", "`")}\`.`,
            username: "ScratchTools Webserver Moderation",
            avatarURL:
              "https://raw.githubusercontent.com/STForScratch/ScratchTools/main/extras/icons/beta/beta128.png",
          });
        }
      } else if (token.user !== req.body.name) {
        await client.db("displaynames").collection("users").insertOne({
          username: token.user,
          lastUpdated: Date.now(),
          displayName: req.body.name,
        });
        webhookClient.send({
          content: `**🪪 Display Name:** @${
            token.user
          } just set their display name to \`${req.body.name
            .replaceAll("\n", " ")
            .replaceAll("`", "`")}\`.`,
          username: "ScratchTools Webserver Moderation",
          avatarURL:
            "https://raw.githubusercontent.com/STForScratch/ScratchTools/main/extras/icons/beta/beta128.png",
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
