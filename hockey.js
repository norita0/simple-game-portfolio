//board
let board;
let boardWidth = 750;
let boardHeight = 250;
let context;

//pucks
let puck;
let paddleWidth = 30;
let paddle1 = {
    x : 30,
    y : 100,
    width : paddleWidth
}
let paddle2 = {
    x : 690,
    y : 100,
    width : paddleWidth
}

//score
let gameEnd = false;
let score1 = 0;
let score2 = 0;
let temp;


window.onload = function() {
    board = document.getElementById("board");
    board.height = boardHeight;
    board.width = boardWidth;

    context = board.getContext("2d"); //used for drawing on the board
    requestAnimationFrame(update);
}

function update() {
    requestAnimationFrame(update);
    if (gameEnd) { //game over, freeze all entities
        return;
    }

    //score
    context.fillStyle="black";
    context.font="20px courier";
    context.fillText(score, 5, 20);
}