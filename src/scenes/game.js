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
            fontSize: '44px', fill: '#fff', stroke: '#000', strokeThickness: 6 
        }).setOrigin(0.5).setDepth(10);

        const startGameHandler = () => {
            if (this.gameActive) return;
            this.gameActive = true;
            this.startText.destroy();
            
            // Unlock audio context for iOS Safari on iPad
            if (this.sound.context.state === 'suspended') {
                this.sound.context.resume();
            }

            this.sound.play('gameStart'); 
            this.music = this.sound.add('bgMusic', { volume: 0.4, loop: true }); 
            this.music.play();
            this.initGameLogic();
        };

        this.input.once('pointerdown', startGameHandler);
        this.input.keyboard.once('keydown-SPACE', startGameHandler);
    }

    initGameLogic() {
        this.plasticGroup = this.physics.add.group();
        this.coralGroup = this.physics.add.group();
        this.isReeling = false;
        this.hookedItem = null;

        // Touch states for iPad
        this.touchMoveLeft = false;
        this.touchMoveRight = false;

        this.spawnFloorLayout();

        this.player = this.physics.add.sprite(100, 250, 'player').setScale(0.25).setCollideWorldBounds(true);
        this.player.body.setBoundsRectangle(new Phaser.Geom.Rectangle(20, 0, 1240, 720));
        this.player.body.setAllowGravity(false);
        this.lineGraphics = this.add.graphics().setDepth(5);

        this.wakeParticles = this.add.particles(0, 0, 'bubble', {
            speed: 20, scale: { start: 0.2, end: 0 },
            alpha: { start: 0.3, end: 0 }, lifespan: 600,
            frequency: 50, emitting: false
        });
        this.wakeParticles.startFollow(this.player, 0, 30);

        this.plasticCount = 0;
        this.maxPlastic = 10; 
        this.coralDamage = 0;
        this.maxCoralDamage = 5; 
        this.timeLeft = 60; 

        this.scoreText = this.add.text(16, 16, `Trash Collected: 0/${this.maxPlastic}`, { fontSize: '30px', fill: '#fff', stroke: '#000', strokeThickness: 4 });
        this.damageText = this.add.text(16, 55, `Coral Damage: 0/${this.maxCoralDamage}`, { fontSize: '30px', fill: '#ff4d4d', stroke: '#000', strokeThickness: 4 });
        this.timerText = this.add.text(1050, 16, `Time: ${this.timeLeft}`, { fontSize: '30px', fill: '#fff', stroke: '#000', strokeThickness: 4 });

        this.fishTimer = this.time.addEvent({ delay: 1800, callback: this.spawnFish, callbackScope: this, loop: true });
        this.bubbleTimer = this.time.addEvent({ delay: 500, callback: this.spawnBubble, callbackScope: this, loop: true });
        this.countdownTimer = this.time.addEvent({ delay: 1000, callback: this.updateTimer, callbackScope: this, loop: true });
        
        this.cursors = this.input.keyboard.createCursorKeys();
        this.spaceBar = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

        // Build iPad Touch Control Buttons
        this.createTouchControls();
    }

    createTouchControls() {
        // Left Button
        const leftBtn = this.add.circle(100, 620, 50, 0xffffff, 0.3)
            .setInteractive()
            .setScrollFactor(0)
            .setDepth(30);
        this.add.text(100, 620, '◄', { fontSize: '40px', fill: '#fff' }).setOrigin(0.5).setDepth(31);

        leftBtn.on('pointerdown', () => { this.touchMoveLeft = true; });
        leftBtn.on('pointerup', () => { this.touchMoveLeft = false; });
        leftBtn.on('pointerout', () => { this.touchMoveLeft = false; });

        // Right Button
        const rightBtn = this.add.circle(230, 620, 50, 0xffffff, 0.3)
            .setInteractive()
            .setScrollFactor(0)
            .setDepth(30);
        this.add.text(230, 620, '►', { fontSize: '40px', fill: '#fff' }).setOrigin(0.5).setDepth(31);

        rightBtn.on('pointerdown', () => { this.touchMoveRight = true; });
        rightBtn.on('pointerup', () => { this.touchMoveRight = false; });
        rightBtn.on('pointerout', () => { this.touchMoveRight = false; });

        // Drop Hook Button
        const hookBtn = this.add.circle(1180, 620, 60, 0xff6b4a, 0.8)
            .setInteractive()
            .setScrollFactor(0)
            .setDepth(30);
        this.add.text(1180, 620, 'HOOK', { fontSize: '24px', fill: '#fff', fontStyle: 'bold' }).setOrigin(0.5).setDepth(31);

        hookBtn.on('pointerdown', () => {
            if (this.gameActive) this.handleFishing();
        });
    }

    update(time, delta) {
        if (!this.gameActive) return; 

        // Delta scaling ensures identical high speeds on both 60Hz and 120Hz iPad Pro displays
        const deltaFactor = delta / 16.666;

        this.player.setVelocityX(0);
        this.lineGraphics.clear();

        const moveLeft = this.cursors.left.isDown || this.touchMoveLeft;
        const moveRight = this.cursors.right.isDown || this.touchMoveRight;

        if (!this.isReeling) {
            if (moveLeft) { 
                this.player.setVelocityX(-650); 
                this.player.setFlipX(false);
                this.wakeParticles.emitting = true;
            }
            else if (moveRight) { 
                this.player.setVelocityX(650); 
                this.player.setFlipX(true); 
                this.wakeParticles.emitting = true;
            } else {
                this.wakeParticles.emitting = false;
            }
        } else {
            this.wakeParticles.emitting = false;
        }

        if (Phaser.Input.Keyboard.JustDown(this.spaceBar)) { 
            this.handleFishing(); 
        }

        if (this.isReeling && this.hookedItem) {
            this.lineGraphics.lineStyle(4, 0xffffff, 0.9);
            this.lineGraphics.lineBetween(this.player.x, this.player.y + 20, this.hookedItem.x, this.hookedItem.y);
            
            // FAST REEL SPEED FOR IPAD: 28px per frame (scaled by delta)
            this.hookedItem.y -= 28 * deltaFactor; 

            if (this.hookedItem.y <= this.player.y + 60) { 
                this.finishReel(); 
            }
        }
    }

    handleFishing() {
        if (this.isReeling) return;
        this.sound.play('whoosh'); 
        
        let allItems = [...this.plasticGroup.getChildren(), ...this.coralGroup.getChildren()].filter(i => i.active);
        let target = allItems.sort((a, b) => Math.abs(a.x - this.player.x) - Math.abs(b.x - this.player.x))[0];
        
        if (target && Math.abs(target.x - this.player.x) < 90) {
            this.sound.play('splash'); 
            this.isReeling = true;
            this.hookedItem = target;
        }
    }

    finishReel() {
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
        if (this.hookedItem) this.hookedItem.destroy();
        this.hookedItem = null;
        this.isReeling = false;
        this.lineGraphics.clear();
    }

    updateTimer() {
        if (!this.gameActive) return;
        if (this.timeLeft > 0) {
            this.timeLeft--;
            this.timerText.setText('Time: ' + this.timeLeft);
            if (this.timeLeft <= 10) {
                this.timerText.setStyle({ fill: '#ff0000' });
            } else {
                this.timerText.setStyle({ fill: '#fff' });
            }
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

        this.add.text(640, 320, msg, { fontSize: '56px', fill: '#fff', stroke: '#000', strokeThickness: 6 }).setOrigin(0.5).setDepth(20);
        this.add.text(640, 420, 'Tap Screen to Restart', { fontSize: '32px', fill: '#fff', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5).setDepth(20);
        
        const restartHandler = () => this.scene.restart();
        this.input.once('pointerdown', restartHandler);
        this.input.keyboard.once('keydown-R', restartHandler);
    }

    spawnFish() {
        if (this.gameOverState) return;

        const fishKey = Phaser.Utils.Array.GetRandom(['fish1', 'fish2']);
        const swimFromLeft = Math.random() < 0.5;
        
        const startX = swimFromLeft ? -100 : 1380;
        const endX = swimFromLeft ? 1380 : -100;
        const startY = Phaser.Math.Between(350, 520);
        const endY = Phaser.Math.Between(350, 520);
        
        const controlX = 640 + Phaser.Math.Between(-150, 150);
        const controlY = startY + Phaser.Math.Between(-150, 150);

        const duration = Phaser.Math.Between(6000, 9500);
        const baseScale = Phaser.Math.FloatBetween(0.09, 0.14);
        const alpha = Phaser.Math.FloatBetween(0.5, 0.85);

        const p1 = new Phaser.Math.Vector2(startX, startY);
        const p2 = new Phaser.Math.Vector2(controlX, controlY);
        const p3 = new Phaser.Math.Vector2(endX, endY);
        const curve = new Phaser.Curves.QuadraticBezier(p1, p2, p3);

        const fish = this.add.sprite(startX, startY, fishKey)
            .setAlpha(alpha)
            .setDepth(1);

        const facingDirection = swimFromLeft ? 1 : -1;
        fish.setScale(baseScale * facingDirection, baseScale);

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

                let pitch = Math.atan2(tangent.y, Math.abs(tangent.x));
                fish.rotation = Phaser.Math.Clamp(pitch * 0.4, -0.35, 0.35);
            },
            onComplete: () => fish.destroy()
        });

        this.tweens.add({
            targets: fish,
            scaleY: baseScale * Phaser.Math.FloatBetween(0.96, 1.04),
            duration: Phaser.Math.Between(1000, 1600),
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });
    }

    spawnBubble() {
        if (this.gameOverState) return;
        const bubble = this.add.image(640, 750, 'bubble').setScale(0.5).setAlpha(0.4);
        this.tweens.add({
            targets: bubble, y: 450, x: 640, duration: 3000,
            onComplete: () => this.tweens.add({ targets: bubble, alpha: 0, duration: 400, onComplete: () => bubble.destroy() })
        });
    }

    spawnFloorLayout() {
        const trashKeys = ['bag', 'bottle', 'trash'];
        const coralKeys = ['pink1', 'pink2', 'pink3', 'purple1', 'purple2', 'purple3'];

        const totalItems = 20;
        const startX = 80;
        const stepX = (1200 - startX) / (totalItems - 1);

        let itemPool = [];
        for (let i = 0; i < 10; i++) {
            itemPool.push({ type: 'trash', key: Phaser.Utils.Array.GetRandom(trashKeys) });
            itemPool.push({ type: 'coral', key: Phaser.Utils.Array.GetRandom(coralKeys) });
        }
        Phaser.Utils.Array.Shuffle(itemPool);

        itemPool.forEach((itemData, index) => {
            const x = startX + index * stepX;
            const y = Phaser.Math.Between(650, 675);

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