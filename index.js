const { App } = require("@slack/bolt");
const token = process.env['BOT_TOKEN']
const ss = process.env['SIGNING_SECRET']
const channel = "C021CQCHP09" //C021CQCHP09 for test, ??? for actual
const app = new App({
	token: token,
	signingSecret: ss
});
let fish = 0;
let game = false;
let players = {};
let fishValue = 2;

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
			await eph(`Keep your eyes out for a transaction of ${value * fishValue + bonus}HN into your account!`, key)
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
			await speak(`The fish population has doubled! Now there are *${fish}* :fish: in the lake!`)
		}
		if (time % 300000 == 0 && fish > 0) {
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
		await say("Sorry, right now we can only play one game at a time. ")
	} else {
		fish = 10;
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
			await eph(`Woah! You're hauling over half of the fish in the lake! For the sake of being fair to the others, let's keep that at fifty percent.`, user)
			number = Math.floor(fish/2);
		}
		if (!players[user]) {
			players[user] = 0;
		}
		players[user] += number;
		fish -= number;
		await say(`:fishing_pole_and_fish: <@${user}> just fished! They now have *${players[user]}* fish.\nThere are now ${fish} fish remaining!`)
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
	endGame(true);
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