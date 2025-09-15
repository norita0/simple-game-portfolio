
//board
let board;
let boardWidth = 750;
let boardHeight = 250;
let context;

//text 
let text = new Image();
let pause = true;

//daikon
let daikonRunWidth = 110;
let daikonRunHeight = 120;
let daikonDuckWidth = 100; //was 118
let daikonDuckHeight = 65;
let daikonX = 30;
let daikonY = boardHeight - daikonRunHeight;
let daikonImg;
let animation = 1;
let running = true;
let frameWait = 10;

let daikon = {
    x : daikonX,
    y : daikonY,
    width : daikonRunWidth,
    height : daikonRunHeight
}

//tomato
let entityArray = [];

let tomato1Width = 50; //was 34
let tomato2Width = 69;
let tomato3Width = 102;

let tomatoHeight = 70;
let tomatoX = 700;
let tomatoY = boardHeight - tomatoHeight;

let tomato1Img;
let tomato2Img;
let tomato3Img;

//carrot

let carrotWidth = 97;
let carrotHeight = 30;
let carrotX = 700;
let carrotY = boardHeight - carrotHeight;

let carrotImg;

//physics
let velocityX = -5; //tomato moving left speed
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

    //draw initial daikonsaur
    // context.fillStyle="green";
    // context.fillRect(daikon.x, daikon.y, daikon.width, daikon.height);

    daikonImg = new Image();
    daikonImg.src = "./daikon_img/daikon.png";
    daikonImg.onload = function() {
        context.drawImage(daikonImg, daikon.x, daikon.y, daikon.width, daikon.height);
    }

    tomato1Img = new Image();
    tomato1Img.src = "./daikon_img/tomato.png";
    ///////////// ONLY HAVE 1 OBSTACLE //////////////////////////////
    tomato2Img = new Image();
    tomato2Img.src = "./daikon_img/tomato.png";

    tomato3Img = new Image();
    tomato3Img.src = "./daikon_img/tomato.png";
    //////////// CHANGE IMAGE ABOVE FOR DIFFERENT OBSTACLES /////////

    carrotImg = new Image();
    carrotImg.src = "./daikon_img/carrot.png";

    requestAnimationFrame(update);
    setInterval(placeTomato, 800); //1000 milliseconds = 1 second
    document.addEventListener("keydown", moveDaikon);
}

function update() {
    requestAnimationFrame(update);
    if (gameOver) { //game over, freeze all entities
        //delete all sprite and redraw in order of sequence
        context.clearRect(0, 0, board.width, board.height);
        //tomato
        for (let i = 0; i < entityArray.length; i++) {
            let tomato = entityArray[i];
            context.drawImage(tomato.img, tomato.x, tomato.y, tomato.width, tomato.height);
        }
        //daikon, text, and score
        daikonImg.src = "./daikon_img/daikon-dead.png";
        text.src = "./img/game-over.png";
        context.drawImage(daikonImg, daikon.x, daikon.y, daikon.width, daikon.height);
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
    else if (daikon.y != daikonY && !running) {     //jumping sprite
        daikonImg.src = "./daikon_img/daikon.png";
        frameWait = 5;
    }
    else if (running && animation == 1) {       //running animation 1
        daikonImg.src = "./daikon_img/daikon-run1.png";
        animation = 2;
        frameWait = 15;
    }
    else if (running && animation == 2) {       //running animation 2
        daikonImg.src = "./daikon_img/daikon-run2.png";
        animation = 1;
        frameWait = 15;
    }
    else if (animation == 3) {          //ducking animation 1
        daikonImg.src = "./daikon_img/daikon-duck1.png";
        frameWait = 10;
        animation = 4;
    }
    else if (animation == 4) {      //ducking animation 2
        daikonImg.src = "./daikon_img/daikon-duck2.png";
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

    //daikon
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
    if (daikon.y != daikonY) {  // daikon is in the air
        if (!running) {  // If ducking in air, maintain ducking sprite
            daikonImg.src = "./daikon_img/daikon-duck1.png"; 
        } else {  // Otherwise, keep normal jump sprite
            daikonImg.src = "./daikon_img/daikon.png";
        }
    }


    gravity = Math.max(gravity, 0.01);
    daikon.y = Math.min(daikon.y + velocityY, daikonY); //apply gravity to current daikon.y, making sure it doesn't exceed the ground
    temp = daikon.y;
    context.drawImage(daikonImg, daikon.x, daikon.y, daikon.width, daikon.height);


    //draw entity
    for (let i = 0; i < entityArray.length; i++) {
        let entity = entityArray[i];
        entity.x += velocityX;

        ////  mechanism for animating carrot for potiential use:    ////
        /*
        if (entity.isCarrot) {
            if (entity.frameWait > 1) {
                entity.frameWait--;
            } else {
                entity.img.src = (entity.animation == 1) ? "./daikon_img/NinjinBlue.png" : "./daikon_img/NinjinBlue.png";
                // change sprite to allow animation for the Ninjin.
                entity.animation = (entity.animation == 1) ? 2 : 1;
                entity.frameWait = 40;  // Reset only **this** object's animation timing
            }
        }
        */

        context.drawImage(entity.img, entity.x, entity.y, entity.width, entity.height);
        

        if (detectCollision(daikon, entity)) {
            gameOver = true;
            if (!running) {
                running = true;
                daikon.width = daikonRunWidth;
                daikon.height = daikonRunHeight;
                daikonY -= (daikonRunHeight - daikonDuckHeight);
                daikon.y = daikonY;
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
        //daikonImg.src = "./daikon_img/daikon.png";
        animation = 1;
        daikon.width = daikonRunWidth;
        daikon.height = daikonRunHeight;
        daikonY = boardHeight - daikon.height;
    }
});

function moveDaikon(e) {
    if (gameOver) {
        if ( e.code == "KeyR") {    //restart
            reset();
        }
        return;
    }
    if ((e.code == "ArrowUp" || e.code == "KeyW") && daikon.y == daikonY) { //jump
        gravity = .3;
        velocityY = -6;
    }
    else if (e.code === "ArrowDown" || e.code == "KeyS") {  //duck
        if (!running) {
            return;
        }
        running = false;
        daikonImg.src = "./daikon_img/daikon-duck1.png";
        animation = 3;
        daikon.width = daikonDuckWidth;
        daikon.height = daikonDuckHeight;
        daikonY = boardHeight - daikon.height;
        //daikonY -= (daikonRunHeight - daikonDuckHeight);
    }
    else if (e.code == "Escape") {  //pause
        pause = true;
    }
    else if (pause && e.code == "Space") {  //start
        pause = false;
    }
}

function placeTomato() {
    if (gameOver) {
        return;
    }

    //place tomato
    let tomato = {
        img : null,
        x : tomatoX,
        y : tomatoY,
        width : null,
        height: tomatoHeight,
        isCarrot : false
    }
    //place carrot
    let carrot = {
        img : carrotImg,
        x : carrotX,
        y : null,
        width : carrotWidth,
        height : carrotHeight,
        isCarrot : true,
        animation : 1,
        frameWait : 40
    }

    let placeEntityChance = Math.random(); //0 - 0.9999...

    if (placeEntityChance > .80) { //20% you get tomato3
        tomato.img = tomato3Img;
        tomato.width = tomato3Width;
        entityArray.push(tomato);
    }
    else if (placeEntityChance > .60) {        //20% you get high carrot height
        carrot.y = carrotY - 130;
        entityArray.push(carrot);
    }
    else if (placeEntityChance > .50) { //10% you get tomato2
        tomato.img = tomato2Img;
        tomato.width = tomato2Width;
        entityArray.push(tomato);
    }
    else if (placeEntityChance > .40) {        //10% you get medium carrot height
        carrot.y = carrotY - 70 ;
        entityArray.push(carrot);
    }
    else if (placeEntityChance > .30) {        //10% you get low carrot height
        carrot.y = carrotY;
        entityArray.push(carrot);
    }
    else if (placeEntityChance > .20) { //10% you get tomato1
        tomato.img = tomato1Img;
        tomato.width = tomato1Width;
        entityArray.push(tomato);
    }

    if (entityArray.length > 2) {
        entityArray.shift(); //remove the first element from the array so that the array doesn't constantly grow
    }
}

function detectCollision(daikon, entity) {
    if (!running) {
        return (rectCollision(daikon, entity));
    }
    // Define sub-sections for better collision approximation
    let daikonHead = { x: daikon.x + 10, y: daikon.y, width: 55 , height: 20 }; // Head section
    let daikonBody = { x: daikon.x + 20, y: daikon.y + 35, width: 60, height: 60 }; // Body
    let daikonLegs = { x: daikon.x + 23, y: daikon.y + 95, width: 50, height: 10 }; // Legs 

    return (
        rectCollision(daikonHead, entity) ||
        rectCollision(daikonBody, entity) ||
        rectCollision(daikonLegs, entity)
    );
}

function rectCollision(a, b) {
    return a.x < b.x + b.width &&   //a's top left corner doesn't reach b's top right corner
           a.x + a.width > b.x &&   //a's top right corner passes b's top left corner
           a.y < b.y + b.height &&  //a's top left corner doesn't reach b's bottom left corner
           a.y + a.height > b.y;    //a's bottom left corner passes b's top left corner
}

function reset() {
    daikonImg.src = ".\\img\\daikon.png";
    running = true;
    animation = 1;
    daikon.width = daikonRunWidth;
    daikon.height = daikonRunHeight;
    daikonY = boardHeight - daikon.height;
    gameOver = false;
    entityArray = [];
    score = 0;
    velocityX = -5;
    velocityY = 0;
}