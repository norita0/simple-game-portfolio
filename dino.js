
//board
let board;
let boardWidth = 750;
let boardHeight = 250;
let context;

//text 
let text = new Image();
let pause = true;

//dino
let dinoRunWidth = 88;
let dinoRunHeight = 94;
let dinoDuckWidth = 118;
let dinoDuckHeight = 60;
let dinoX = 50;
let dinoY = boardHeight - dinoRunHeight;
let dinoImg;
let animation = 1;
let running = true;
let frameWait = 10;

let dino = {
    x : dinoX,
    y : dinoY,
    width : dinoRunWidth,
    height : dinoRunHeight
}

//cactus
let entityArray = [];

let cactus1Width = 34;
let cactus2Width = 69;
let cactus3Width = 102;

let cactusHeight = 70;
let cactusX = 700;
let cactusY = boardHeight - cactusHeight;

let cactus1Img;
let cactus2Img;
let cactus3Img;

//bird

let birdWidth = 97;
let birdHeight = 68;
let birdX = 700;
let birdY = boardHeight - birdHeight;

let birdImg;

//physics
let velocityX = -5; //cactus moving left speed
let velocityY = 0;
let gravity = .3;

let gameOver = false;
let score = 0;
let temp;

window.onload = function() {
    board = document.getElementById("board");
    board.height = boardHeight;
    board.width = boardWidth;

    context = board.getContext("2d"); //used for drawing on the board

    //draw initial dinosaur
    // context.fillStyle="green";
    // context.fillRect(dino.x, dino.y, dino.width, dino.height);

    dinoImg = new Image();
    dinoImg.src = "./img/dino.png";
    dinoImg.onload = function() {
        context.drawImage(dinoImg, dino.x, dino.y, dino.width, dino.height);
    }

    cactus1Img = new Image();
    cactus1Img.src = "./img/cactus1.png";

    cactus2Img = new Image();
    cactus2Img.src = "./img/cactus2.png";

    cactus3Img = new Image();
    cactus3Img.src = "./img/cactus3.png";

    birdImg = new Image();
    birdImg.src = "./img/bird1.png";

    requestAnimationFrame(update);
    setInterval(placeCactus, 800); //1000 milliseconds = 1 second
    document.addEventListener("keydown", moveDino);
}

function update() {
    requestAnimationFrame(update);
    if (gameOver) { //game over, freeze all entities
        //delete all sprite and redraw in order of sequence
        context.clearRect(0, 0, board.width, board.height);
        //cactus
        for (let i = 0; i < entityArray.length; i++) {
            let cactus = entityArray[i];
            context.drawImage(cactus.img, cactus.x, cactus.y, cactus.width, cactus.height);
        }
        //dino, text, and score
        dinoImg.src = "./img/dino-dead.png";
        text.src = "./img/game-over.png";
        context.drawImage(dinoImg, dino.x, dino.y, dino.width, dino.height);
        context.drawImage(text, 100, 70, 500, 70);
        context.fillText(score.toFixed(0), 5, 20);
        return;
    }
    else if (pause) {
        text.src = "./img/text.png";
        text.onload = function() {
            context.drawImage(text, 100, 70, 500, 70);
        }
        return;
    }
    else if (frameWait != 0) {       //wait
        frameWait --;
    }
    else if (dino.y != dinoY && !running) {     //jumping sprite
        dinoImg.src = "./img/dino.png";
        frameWait = 5;
    }
    else if (running && animation == 1) {       //running animation 1
        dinoImg.src = "./img/dino-run1.png";
        animation = 2;
        frameWait = 15;
    }
    else if (running && animation == 2) {       //running animation 2
        dinoImg.src = "./img/dino-run2.png";
        animation = 1;
        frameWait = 15;
    }
    else if (animation == 3) {          //ducking animation 1
        dinoImg.src = "./img/dino-duck1.png";
        frameWait = 10;
        animation = 4;
    }
    else if (animation == 4) {      //ducking animation 2
        dinoImg.src = "./img/dino-duck2.png";
        frameWait = 10;
        animation = 3;
    }
    
    //make faster as game progresses
    if (score.toFixed(0) == 90) {
        velocityX = -5.5;
    }
    if (score.toFixed(0) == 100) {
        velocityX = -6;
    }
    if (score.toFixed(0) == 120) {
        velocityX = -6.5;
    }
    if (score.toFixed(0) == 140) {
        velocityX = -7;
    }
    else if (score.toFixed(0) == 500) {
        velocityX = -8;
    }
    context.clearRect(0, 0, board.width, board.height);

    //dino
    if (velocityY == -6) {
        velocityY += 2;
    }
    if (velocityY < 0.5) {  //adjust velocity so it is slower near high point of jump
        velocityY += 0.05;
    }
    else {
        velocityY += gravity;
    }

    ///NEW CODE
    if (dino.y != dinoY) {  // Dino is in the air
        if (!running) {  // If ducking in air, maintain ducking sprite
            dinoImg.src = "./img/dino-duck1.png"; 
        } else {  // Otherwise, keep normal jump sprite
            dinoImg.src = "./img/dino.png";
        }
    }


    gravity = Math.max(gravity, 0.01);
    dino.y = Math.min(dino.y + velocityY, dinoY); //apply gravity to current dino.y, making sure it doesn't exceed the ground
    temp = dino.y;
    context.drawImage(dinoImg, dino.x, dino.y, dino.width, dino.height);


    //draw entity
    for (let i = 0; i < entityArray.length; i++) {
        let entity = entityArray[i];
        entity.x += velocityX;
        if (entity.isBird) {
            if (entity.frameWait > 1) {
                entity.frameWait--;
            } else {
                entity.img.src = (entity.animation == 1) ? "./img/bird2.png" : "./img/bird1.png";
                entity.animation = (entity.animation == 1) ? 2 : 1;
                entity.frameWait = 40;  // Reset only **this** bird’s animation timing
            }
        }

        context.drawImage(entity.img, entity.x, entity.y, entity.width, entity.height);
        

        if (detectCollision(dino, entity)) {
            gameOver = true;
            if (!running) {
                running = true;
                dino.width = dinoRunWidth;
                dino.height = dinoRunHeight;
                dinoY -= (dinoRunHeight - dinoDuckHeight);
                dino.y = dinoY;
            }
        }
    }

    //score
    context.fillStyle="black";
    context.font="20px courier";
    score += 0.1;
    context.fillText(score.toFixed(0), 5, 20);
}

//stop duck and run
document.addEventListener("keyup", function(event) {
    if (event.code === "ArrowDown" || event.code == "KeyS") {
        if (gameOver) {
            return;
        }
        running = true;
        //dinoImg.src = "./img/dino.png";
        animation = 1;
        dino.width = dinoRunWidth;
        dino.height = dinoRunHeight;
        dinoY = boardHeight - dino.height;
    }
});

function moveDino(e) {
    if (gameOver) {
        if ( e.code == "KeyR") {    //restart
            reset();
        }
        return;
    }
    if ((e.code == "ArrowUp" || e.code == "KeyW") && dino.y == dinoY) { //jump
        gravity = .3;
        velocityY = -6;
    }
    else if (e.code === "ArrowDown" || e.code == "KeyS") {  //duck
        if (!running) {
            return;
        }
        running = false;
        dinoImg.src = "./img/dino-duck1.png";
        animation = 3;
        dino.width = dinoDuckWidth;
        dino.height = dinoDuckHeight;
        dinoY = boardHeight - dino.height;
        //dinoY -= (dinoRunHeight - dinoDuckHeight);
    }
    else if (e.code == "Escape") {  //pause
        pause = true;
    }
    else if (pause && e.code == "Space") {  //start
        pause = false;
    }
}

function placeCactus() {
    if (gameOver) {
        return;
    }

    //place cactus
    let cactus = {
        img : null,
        x : cactusX,
        y : cactusY,
        width : null,
        height: cactusHeight,
        isBird : false
    }
    //place bird
    let bird = {
        img : birdImg,
        x : birdX,
        y : null,
        width : birdWidth,
        height : birdHeight,
        isBird : true,
        animation : 1,
        frameWait : 40
    }

    let placeEntityChance = Math.random(); //0 - 0.9999...

    if (placeEntityChance > .80) { //20% you get cactus3
        cactus.img = cactus3Img;
        cactus.width = cactus3Width;
        entityArray.push(cactus);
    }
    else if (placeEntityChance > .70) {        //10% you get high bird height
        bird.y = birdY - 110;
        entityArray.push(bird);
    }
    else if (placeEntityChance > .60) { //10% you get cactus2
        cactus.img = cactus2Img;
        cactus.width = cactus2Width;
        entityArray.push(cactus);
    }
    else if (placeEntityChance > .50) {        //10% you get medium bird height
        bird.y = birdY - 65;
        entityArray.push(bird);
    }
    else if (placeEntityChance > .40) {        //10% you get low bird height
        bird.y = birdY;
        entityArray.push(bird);
    }
    else if (placeEntityChance > .20) { //10% you get cactus1
        cactus.img = cactus1Img;
        cactus.width = cactus1Width;
        entityArray.push(cactus);
    }

    if (entityArray.length > 2) {
        entityArray.shift(); //remove the first element from the array so that the array doesn't constantly grow
    }
}

function detectCollision(dino, entity) {
    if (!running) {
        return (rectCollision(dino, entity));
    }
    // Define sub-sections for better collision approximation
    let dinoHead = { x: dino.x + 20, y: dino.y, width: 48, height: 40 }; // Head section
    let dinoBody = { x: dino.x + 10, y: dino.y + 40, width: 60, height: 40 }; // Body
    let dinoLegs = { x: dino.x + 15, y: dino.y + 80, width: 30, height: 20 }; // Legs

    return (
        rectCollision(dinoHead, entity) ||
        rectCollision(dinoBody, entity) ||
        rectCollision(dinoLegs, entity)
    );
}

function rectCollision(a, b) {
    return a.x < b.x + b.width &&   //a's top left corner doesn't reach b's top right corner
           a.x + a.width > b.x &&   //a's top right corner passes b's top left corner
           a.y < b.y + b.height &&  //a's top left corner doesn't reach b's bottom left corner
           a.y + a.height > b.y;    //a's bottom left corner passes b's top left corner
}

function reset() {
    dinoImg.src = ".\\img\\dino.png";
    running = true;
    animation = 1;
    dino.width = dinoRunWidth;
    dino.height = dinoRunHeight;
    dinoY = boardHeight - dino.height;
    gameOver = false;
    entityArray = [];
    score = 0;
    velocityX = -5;
    velocityY = 0;
}