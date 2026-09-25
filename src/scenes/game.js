export class Game extends Phaser.Scene {
    constructor() {
        super('Game');
    }

    preload() {
        this.load.image('background', 'assets/images/background.jpg');
        this.load.image('player', 'assets/images/player.PNG');
        ['pink1', 'pink2', 'pink3'].forEach((name, i) => this.load.image(name, `assets/images/pink_coral${i+1}.PNG`));
        ['purple1', 'purple2', 'purple3'].forEach((name, i) => this.load.image(name, `assets/images/purple_coral${i+1}.PNG`));
        this.load.image('bag', 'assets/images/bag.PNG');
        this.load.image('bottle', 'assets/images/bottle.PNG');
        this.load.image('trash', 'assets/images/trash.PNG');
        this.load.image('fish1', 'assets/images/fish1.png');
        this.load.image('fish2', 'assets/images/fish2.png');

        // Audio
        this.load.audio('bgMusic', 'assets/audio/background_music.mp3');
        this.load.audio('gameStart', 'assets/audio/game_start.mp3');
        this.load.audio('whoosh', 'assets/audio/rod_whoosh.mp3');
        this.load.audio('splash', 'assets/audio/splash.mp3');
        this.load.audio('collect', 'assets/audio/collect.mp3');
        this.load.audio('damage', 'assets/audio/damage.mp3');
        this.load.audio('winner', 'assets/audio/winner.mp3');
        this.load.audio('gameOver', 'assets/audio/game_over.mp3');
    }

    create() {
        this.add.image(0, 0, 'background').setOrigin(0, 0);
        this.showStartScreen();
        
        let graphics = this.make.graphics({ x: 0, y: 0, add: false });
        graphics.fillStyle(0xffffff, 0.4);
        graphics.fillCircle(10, 10, 10);
        graphics.generateTexture('bubble', 20, 20);
    }

    showStartScreen() {
        this.gameActive = false;
        this.gameOverState = false;
        this.startText = this.add.text(640, 360, 'Tap Screen to Start', { 
            fontSize: '42px', fill: '#fff', stroke: '#000', strokeThickness: 6 
        }).setOrigin(0.5).setDepth(10);

        const startGame = () => {
            if (this.gameActive) return;
            this.gameActive = true;
            this.startText.destroy();
            this.sound.play('gameStart'); 
            this.music = this.sound.add('bgMusic', { volume: 0.4, loop: true }); 
            this.music.play();
            this.initGameLogic();
        };

        this.input.keyboard.once('keydown-SPACE', startGame);
        this.input.once('pointerdown', startGame);
    }

    initGameLogic() {
        this.plasticGroup = this.physics.add.group();
        this.coralGroup = this.physics.add.group();

        // Player Controls setup
        this.cursors = this.input.keyboard.createCursorKeys();
        this.keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
        this.keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
        
        this.player = this.physics.add.sprite(100, 250, 'player').setScale(0.25).setCollideWorldBounds(true);
        this.player.body.setBoundsRectangle(new Phaser.Geom.Rectangle(20, 0, 1240, 720));
        this.player.body.setAllowGravity(false);
        this.playerSpeed = 300;

        // Gold Miner Hook States
        this.hookState = 'SWINGING';
        this.hookAngle = 0; 
        this.hookSpeed = 0.012; 
        this.hookDirection = 1; 
        this.maxAngle = Math.PI / 3; 
        
        this.minLineLength = 28; 
        this.lineLength = this.minLineLength; 
        this.maxLineLength = 550; 
        this.hookedItem = null;
        this.reelSpeed = 6; 

        this.plasticCount = 0;
        this.maxPlastic = 10; 
        this.coralDamage = 0;
        this.maxCoralDamage = 5; 
        this.timeLeft = 70;

        this.spawnFloorLayout();

        this.lineGraphics = this.add.graphics().setDepth(5);

        this.scoreText = this.add.text(16, 16, `Trash Collected: 0/${this.maxPlastic}`, { fontSize: '32px', fill: '#fff', stroke: '#000', strokeThickness: 4 });
        this.damageText = this.add.text(16, 55, `Coral Damage: 0/${this.maxCoralDamage}`, { fontSize: '32px', fill: '#ff4d4d', stroke: '#000', strokeThickness: 4 });
        this.timerText = this.add.text(1050, 16, `Time: ${this.timeLeft}`, { fontSize: '32px', fill: '#fff', stroke: '#000', strokeThickness: 4 });

        this.fishTimer = this.time.addEvent({ delay: 1800, callback: this.spawnFish, callbackScope: this, loop: true });
        this.bubbleTimer = this.time.addEvent({ delay: 300, callback: this.spawnBubble, callbackScope: this, loop: true });
        this.countdownTimer = this.time.addEvent({ delay: 1000, callback: this.updateTimer, callbackScope: this, loop: true });
        
        this.spaceBar = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

        // iPad Touch Setup
        this.setupTouchUI();
    }

    setupTouchUI() {
        this.isTouchLeft = false;
        this.isTouchRight = false;

        // Visual On-Screen Movement Buttons for iPad
        const btnY = 660;
        const leftBtn = this.add.rectangle(100, btnY, 140, 80, 0x000000, 0.4).setInteractive().setDepth(20);
        this.add.text(100, btnY, '◀ LEFT', { fontSize: '24px', fill: '#fff' }).setOrigin(0.5).setDepth(21);

        const rightBtn = this.add.rectangle(1180, btnY, 140, 80, 0x000000, 0.4).setInteractive().setDepth(20);
        this.add.text(1180, btnY, 'RIGHT ▶', { fontSize: '24px', fill: '#fff' }).setOrigin(0.5).setDepth(21);

        leftBtn.on('pointerdown', () => { this.isTouchLeft = true; });
        leftBtn.on('pointerup', () => { this.isTouchLeft = false; });
        leftBtn.on('pointerout', () => { this.isTouchLeft = false; });

        rightBtn.on('pointerdown', () => { this.isTouchRight = true; });
        rightBtn.on('pointerup', () => { this.isTouchRight = false; });
        rightBtn.on('pointerout', () => { this.isTouchRight = false; });

        // Tap top main screen area to drop hook
        this.input.on('pointerdown', (pointer) => {
            if (pointer.y < 600) {
                this.triggerHookDrop();
            }
        });
    }

    triggerHookDrop() {
        if (this.hookState === 'SWINGING') {
            this.hookState = 'SHOOTING';
            this.sound.play('whoosh');
        }
    }

    update() {
        if (!this.gameActive) return; 

        // 1. PLAYER MOVEMENT
        this.player.setVelocityX(0);
        if (this.cursors.left.isDown || this.keyA.isDown || this.isTouchLeft) {
            this.player.setVelocityX(-this.playerSpeed);
            this.player.setFlipX(true);
        } else if (this.cursors.right.isDown || this.keyD.isDown || this.isTouchRight) {
            this.player.setVelocityX(this.playerSpeed);
            this.player.setFlipX(false);
        }

        // 2. HOOK & LINE LOGIC
        this.lineGraphics.clear();
        
        const offsetX = this.player.flipX ? 70 : -70;
        const startX = this.player.x + offsetX;
        const startY = this.player.y + 62;

        if (this.hookState === 'SWINGING') {
            this.hookAngle += this.hookSpeed * this.hookDirection;
            if (this.hookAngle > this.maxAngle) this.hookDirection = -1;
            if (this.hookAngle < -this.maxAngle) this.hookDirection = 1;

            if (Phaser.Input.Keyboard.JustDown(this.spaceBar)) {
                this.triggerHookDrop();
            }
        } 
        else if (this.hookState === 'SHOOTING') {
            this.lineLength += 12;

            const hookX = startX + Math.sin(this.hookAngle) * this.lineLength;
            const hookY = startY + Math.cos(this.hookAngle) * this.lineLength;

            let allItems = [...this.plasticGroup.getChildren(), ...this.coralGroup.getChildren()].filter(i => i.active);
            for (let item of allItems) {
                if (Phaser.Math.Distance.Between(hookX, hookY, item.x, item.y) < 35) {
                    this.sound.play('splash');
                    this.hookedItem = item;
                    this.hookState = 'REELING';
                    this.reelSpeed = this.plasticGroup.contains(item) ? 6 : 3.5;
                    break;
                }
            }

            if (this.lineLength >= this.maxLineLength || hookY >= 700) {
                this.hookState = 'REELING';
                this.reelSpeed = 8;
            }
        } 
        else if (this.hookState === 'REELING') {
            this.lineLength -= this.reelSpeed;

            if (this.hookedItem) {
                this.hookedItem.x = startX + Math.sin(this.hookAngle) * this.lineLength;
                this.hookedItem.y = startY + Math.cos(this.hookAngle) * this.lineLength + 18;
            }

            if (this.lineLength <= this.minLineLength) {
                this.lineLength = this.minLineLength;
                this.finishReel();
            }
        }

        const endX = startX + Math.sin(this.hookAngle) * this.lineLength;
        const endY = startY + Math.cos(this.hookAngle) * this.lineLength;

        this.lineGraphics.lineStyle(3, 0xcccccc);
        this.lineGraphics.lineBetween(startX, startY, endX, endY);

        const isClawOpen = this.hookState !== 'REELING' || !this.hookedItem;
        this.drawClaw(endX, endY, -this.hookAngle, isClawOpen);
    }

    drawClaw(x, y, angle, isOpen) {
        this.lineGraphics.save();
        this.lineGraphics.translateCanvas(x, y);
        this.lineGraphics.rotateCanvas(angle);

        this.lineGraphics.lineStyle(3.5, 0xd4af37); 
        this.lineGraphics.strokeCircle(0, 0, 6);

        const leftAngle = isOpen ? -0.65 : -0.25;
        this.lineGraphics.beginPath();
        this.lineGraphics.moveTo(0, 0);
        this.lineGraphics.lineTo(Math.sin(leftAngle) * 22, Math.cos(leftAngle) * 22);
        this.lineGraphics.lineTo(Math.sin(leftAngle - 0.5) * 28, Math.cos(leftAngle - 0.5) * 28 - 5);
        this.lineGraphics.strokePath();

        const rightAngle = isOpen ? 0.65 : 0.25;
        this.lineGraphics.beginPath();
        this.lineGraphics.moveTo(0, 0);
        this.lineGraphics.lineTo(Math.sin(rightAngle) * 22, Math.cos(rightAngle) * 22);
        this.lineGraphics.lineTo(Math.sin(rightAngle + 0.5) * 28, Math.cos(rightAngle + 0.5) * 28 - 5);
        this.lineGraphics.strokePath();

        this.lineGraphics.restore();
    }

    finishReel() {
        if (this.hookedItem) {
            if (this.plasticGroup.contains(this.hookedItem)) {
                this.sound.play('collect'); 
                this.plasticCount++;
                this.scoreText.setText(`Trash Collected: ${this.plasticCount}/${this.maxPlastic}`);
                if (this.plasticCount >= this.maxPlastic) this.endGame("YOU HELPED SAVE THE OCEAN!", true);
            } else {
                this.sound.play('damage'); 
                this.coralDamage++;
                this.damageText.setText(`Coral Damage: ${this.coralDamage}/${this.maxCoralDamage}`);
                this.cameras.main.shake(300, 0.02); 
                this.player.setTint(0xff0000);
                this.time.delayedCall(200, () => this.player.clearTint());
                this.showPopUpText("CORAL HIT!");
                if (this.coralDamage >= this.maxCoralDamage) this.endGame("GAME OVER", false);
            }
            this.hookedItem.destroy();
            this.hookedItem = null;
        }

        this.hookState = 'SWINGING';
    }

    updateTimer() {
        if (!this.gameActive) return;
        if (this.timeLeft > 0) {
            this.timeLeft--;
            this.timerText.setText('Time: ' + this.timeLeft);
            if (this.timeLeft <= 10) this.timerText.setStyle({ fill: '#ff0000' });
        } else {
            this.endGame("TIME IS UP!", false);
        }
    }

    endGame(msg, isWinner) {
        this.gameActive = false; 
        this.gameOverState = true;
        this.physics.pause();
        if (this.fishTimer) this.fishTimer.remove();
        if (this.bubbleTimer) this.bubbleTimer.remove();
        if (this.countdownTimer) this.countdownTimer.remove();
        this.tweens.killAll();
        if (this.music) this.music.stop(); 
        isWinner ? this.sound.play('winner') : this.sound.play('gameOver'); 

        this.add.text(640, 320, msg, { fontSize: '64px', fill: '#fff', stroke: '#000', strokeThickness: 6 }).setOrigin(0.5).setDepth(20);
        this.add.text(640, 420, 'Tap Screen to Restart', { fontSize: '32px', fill: '#fff', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5).setDepth(20);
        
        const restartGame = () => this.scene.restart();
        this.input.keyboard.once('keydown-R', restartGame);
        this.time.delayedCall(500, () => this.input.once('pointerdown', restartGame));
    }

    spawnFish() {
        if (this.gameOverState) return;

        const fishKey = Phaser.Utils.Array.GetRandom(['fish1', 'fish2']);
        const swimFromLeft = Math.random() < 0.5;
        const startX = swimFromLeft ? -100 : 1380;
        const endX = swimFromLeft ? 1380 : -100;

        const startY = Phaser.Math.Between(480, 600);
        const endY = Phaser.Math.Between(480, 600);
        
        const controlX = 640 + Phaser.Math.Between(-150, 150);
        const controlY = startY + Phaser.Math.Between(-50, 50);

        const duration = Phaser.Math.Between(6000, 9500);
        const baseScale = Phaser.Math.FloatBetween(0.09, 0.14);

        const p1 = new Phaser.Math.Vector2(startX, startY);
        const p2 = new Phaser.Math.Vector2(controlX, controlY);
        const p3 = new Phaser.Math.Vector2(endX, endY);
        const curve = new Phaser.Curves.QuadraticBezier(p1, p2, p3);

        const fish = this.add.sprite(startX, startY, fishKey).setAlpha(0.75).setDepth(1);
        fish.setScale(baseScale * (swimFromLeft ? -1 : 1), baseScale);

        let pathProgress = { value: 0 };
        
        this.tweens.add({
            targets: pathProgress,
            value: 1,
            duration: duration,
            onUpdate: () => {
                const position = curve.getPoint(pathProgress.value);
                const tangent = curve.getTangent(pathProgress.value);
                fish.x = position.x;
                fish.y = position.y;
                fish.rotation = Phaser.Math.Clamp(Math.atan2(-tangent.y, Math.abs(tangent.x)) * 0.4, -0.35, 0.35);
            },
            onComplete: () => fish.destroy()
        });
    }

    spawnBubble() {
        if (this.gameOverState) return;
        const startX = Phaser.Math.Between(40, 1240);
        const startY = Phaser.Math.Between(720, 760);
        const bubble = this.add.image(startX, startY, 'bubble')
            .setScale(Phaser.Math.FloatBetween(0.3, 0.7))
            .setAlpha(Phaser.Math.FloatBetween(0.25, 0.55))
            .setDepth(1);

        this.tweens.add({
            targets: bubble,
            y: Phaser.Math.Between(80, 150),
            x: startX + Phaser.Math.Between(-40, 40),
            duration: Phaser.Math.Between(3500, 5500),
            ease: 'Sine.easeOut',
            onComplete: () => bubble.destroy()
        });
    }

    spawnFloorLayout() {
        const trashKeys = ['bag', 'bottle', 'trash'];
        const coralKeys = ['pink1', 'pink2', 'pink3', 'purple1', 'purple2', 'purple3'];

        const totalItems = 18;
        const startX = 100;
        const stepX = (1180 - startX) / (totalItems - 1);

        let itemPool = [];

        for (let i = 0; i < this.maxPlastic; i++) {
            itemPool.push({ type: 'trash', key: Phaser.Utils.Array.GetRandom(trashKeys) });
        }

        const coralCount = totalItems - this.maxPlastic;
        for (let i = 0; i < coralCount; i++) {
            itemPool.push({ type: 'coral', key: Phaser.Utils.Array.GetRandom(coralKeys) });
        }

        Phaser.Utils.Array.Shuffle(itemPool);

        itemPool.forEach((itemData, index) => {
            const x = startX + index * stepX;
            const y = Phaser.Math.Between(640, 670);

            let item;
            if (itemData.type === 'coral') {
                item = this.coralGroup.create(x, y, itemData.key);
            } else {
                item = this.plasticGroup.create(x, y, itemData.key);
                this.tweens.add({ targets: item, tint: 0xffffaa, duration: 600, yoyo: true, loop: -1 });
            }
            item.setScale(0.08).body.setAllowGravity(false);
            item.setDepth(2);
        });
    }

    showPopUpText(message) {
        let popText = this.add.text(this.player.x, this.player.y, message, { fontSize: '24px', fill: '#ff0000', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5);
        this.tweens.add({ targets: popText, y: popText.y - 100, alpha: 0, duration: 1000, onComplete: () => popText.destroy() });
    }
}