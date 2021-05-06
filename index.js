const { App } = require("@slack/bolt");
const token = process.env['BOT_TOKEN']
const fetch = require("isomorphic-unfetch")
const ss = process.env['SIGNING_SECRET']
const channel = "C021CQCHP09" //C021CQCHP09 for test, ??? for actual
const app = new App({
	token: token,
	signingSecret: ss
});
let fish = 0.5;
let game = false;
let players = {};
let fishValue = 1;

async function speak(text) {
	try {
		const result = await app.client.chat.postMessage({
			channel: channel,
			token: token,
			text: text
		})
	} catch (e) {
		console.error(e);
	}
}

/** async function transact() {
 * fetch('https://hn.rishi.cx', {
 * method: 'POST',
 * headers: {
 * 	
 * }
 * })
} **/

async function eph(text, user) {
	try {
		const result = await app.client.chat.postEphemeral({
			channel: channel,
			user: user,
			token: token,
			text: text
		})
	} catch (e) {
		console.error(e);
	}
}

async function endGame(quit) {
	game = false;
	if (quit) {
		await speak(`You've decided to end the game a little early before time runs out! Because you've quit early, though, you don't get any money. Thanks for playing!`)
	} else {
		score = "";
		bonus = 0;
		if (fish >= 20) {
			score = "A"
			bonus = 2
		} else if (fish < 20 && fish >= 10) {
			score = "B"
			bonus = 1
		} else if (fish < 10 && fish >= 5) {
			score = "C"
		} else if (fish < 5) {
			score = "D"
		}
		await speak(`:hourglass:TIME'S UP!:hourglass:\nThe remaining :fish: population is *${fish}*. Based on your fishing responsibility, you get a rating of *${score}*.\nLet me take all that fish-- Wow, that's a _lot_ you've got there! I'll give you ${fishValue}HN per fish for all your hard work!`)
		let list = "";
		for (let [key, value] of Object.entries(players)) {
			list += `<@${key}> - ${value} :fish:\n`
		}
		await speak(`Here's how many fish each of y'all got: \n${list}`)
		if (bonus > 0) {
			await speak(`This game, you've also done well with fishing responsibly! I'll give each of you ${bonus}HN as a bonus!`)
		}
		for (let [key, value] of Object.entries(players)) {
			await eph(`:moneybag:~Keep your eyes out for a transaction of ${value * fishValue + bonus}HN into your account!~ haven't implemented le mons yet lol`, key)
		}
	}
	fish = 0;
	players = {};
}

async function runGame() {
	let start = new Date().getTime(),
		time = 0;
	async function instance() {
		time += 100;
		if (time % 30000 == 0) {
			fish *= 2;
			await speak(`:two:The fish population has doubled! Now there are *${fish}* :fish: in the lake!`)
		}
		if (time % 120000 == 0 && fish > 0) {
			endGame(false);
		}
		var diff = (new Date().getTime() - start) - time;
		if (game) {
			setTimeout(instance, (100 - diff));
		}
	}
	setTimeout(instance, 100);
}

app.command('/go-fishing', async ({ command, ack, say }) => {
	// Acknowledge command request
	await ack();
	if (game) {
		await say("There's currently a game going on right now! Type */fish* to join in")
	} else {
		fish = 20;
		game = true;
		players = {}
		await say(`Howdy, y'all! Let's go fishing! :fishing_pole_and_fish: Right now, there are *${fish}* :fish: in Hack Lake! Type */fish* to fish`);
		runGame();
	}
});

app.command('/fish', async ({ command, ack, say }) => {
	await ack();
	if (game) {
		let user = command.user_id;
		let number = 1;
		console.log(command.text);
		if (isNaN(command.text) || command.text == "") {
			number = 1;
		} else {
			number = parseInt(command.text);
			number = fish < number ? fish : number;
		}
		if (number > fish/2 && number > 5) {
			await eph(`:warning:Woah! You're hauling over half of the fish in the lake! For the sake of being fair to the others, let's keep that at fifty percent.`, user)
			number = Math.floor(fish/2);
		}
		if (!players[user]) {
			players[user] = 0;
		}
		players[user] += number;
		fish -= number;
		await say(`:fishing_pole_and_fish: <@${user}> just fished! They now have *${players[user]}* fish.\nThere are now *${fish}* fish remaining!`)
		if (fish <= 0) {
			game = false;
			fish = 0;
			players = {};
			await say(`:skull:GAME OVER:skull:\nOh no!! Y'all've ran out of fish! I'm sorry, but you've gained no profits today :cry:\nNevertheless, thanks for playing!`)
		}
	} else {
		await say("You need to start a game before you can fish! To do that, send */go-fishing*")
	}
});

app.command('/end-fishing', async ({ command, ack, say }) => {
	await ack();
	if (game) {
		endGame(true);
	} else {
		say("There isn't a game going on right now! Send */go-fishing* in the chat to start")
	}
});

app.command('/fish-help', async({command, ack, say}) => {
	await ack();
	say(":wave::skin-tone-4:Howdy! Welcome to the Hack Lake, a place run by me, your local fisherman! ~a.k.a. the primordial but retired Aztec god of fishing, Opochtli, but if you ask about that, I will smite you.~\nYour main goals in this game are simple:\n1. Fish. :fishing_pole_and_fish: :tropical_fish:\n2. PROFIT. :money_mouth_face: :hn:\nBut there's a catch-- no, not the I-got-an-Alaskan-crab type of catch-- *Hack Lake can run out of fish!* And if you overfish, you lose all the possible profit you'd get. :chart_with_downwards_trend: You have :two: minutes to fish, and the fish population doubles every :three::zero: seconds. Can you work with others to get the most profit while responsibly maintaining the :fish: population?\nThis is a test of your character, of your greed, of your willingness to cooperate! Are you ready to prove yourself worthy? Type */go-fishing* to start a game, and type */fish* to make a catch. If you ever want to end a game early, type /end-fishing.")
});


(async (req, res) => {
	// Start your app
	try {
		await app.start(process.env.PORT || 3000);
		console.log("The Commons is alive! 🌟")
	} catch (error) {
		console.error(error);
	}
})();