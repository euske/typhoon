/// <reference path="../base/utils.ts" />
/// <reference path="../base/geom.ts" />
/// <reference path="../base/entity.ts" />
/// <reference path="../base/text.ts" />
/// <reference path="../base/scene.ts" />
/// <reference path="../base/app.ts" />

///  game.ts
///

// Mechanics:
//   forced to move northeast (toward upper right).
//   less pressure -> bigger/stronger.
//   city -> lose pressure.
//   ocean -> gain pressure.

//  Initialize the resources.
let FONT: Font;
function main() {
    APP = new App(256, 256);
    FONT = new ShadowFont(APP.images['font'], 'white');
    APP.init(new Title());
}

function drawArrow(
    ctx: CanvasRenderingContext2D, p: Vec2, v: Vec2,
    d: number, r: number) {
    // forward:(v.x, v.y), left:(+v.y, -v.x), right:(-v.y, +v.x)
    ctx.beginPath();
    ctx.moveTo(p.x-r*(v.x+v.y), p.y+r*(v.x-v.y));
    ctx.lineTo(p.x-r*v.y+d*v.x, p.y+r*v.x+d*v.y);
    ctx.lineTo(p.x-2*r*v.y+d*v.x, p.y+2*r*v.x+d*v.y);
    ctx.lineTo(p.x+(d+2*r)*v.x, p.y+(d+2*r)*v.y);
    ctx.lineTo(p.x+2*r*v.y+d*v.x, p.y-2*r*v.x+d*v.y);
    ctx.lineTo(p.x+r*v.y+d*v.x, p.y-r*v.x+d*v.y);
    ctx.lineTo(p.x+r*(v.y-v.x), p.y-r*(v.y+v.x));
    ctx.closePath();
    ctx.fill();
}


//  Typhoon
//
class Typhoon {

    pos: Vec2;
    usermove: Vec2;
    phase = 0;
    pressure = 0;
    casualty = 0;

    constructor(pos: Vec2) {
        this.pos = pos;
        this.usermove = new Vec2();
        this.pressure = rnd(950, 990);
    }

    setMove(v: Vec2) {
        this.usermove = v.copy();
    }

    onTick(imagedata: ImageData) {
        const x = this.pos.x;
        const y = this.pos.y;
        let v1 = Math.pow(1+x*x+y*y, -0.3) + Math.random()*0.05;
        let v2 = Math.pow(1+(x-64)*(x-64)+(y-64)*(y-64), -0.3) + Math.random()*0.05;
        let vx = (v1-v2)*10+0.1 + this.usermove.x*0.2;
        let vy = (v1-v2)*10-0.1 + this.usermove.y*0.2;
        //console.log(v1, v2);
        this.pos.x += vx;
        this.pos.y += vy;
        const col = this.getCollision(imagedata);
        if (0 < col[3]) {
            let dc = Math.floor(col[0] * this.getWind() * 0.1);
            this.casualty += dc;
            let dp = (col[0]*4 + col[1]*2 - col[2]) / col[3];
            //console.log(col, dp);
            this.pressure += dp;
            if (this.phase % 5 == 0) {
                if (2 < dc) {
                    APP.playSound('scream'+(1+rnd(3)));
                }
            }
        }
        this.phase++;
    }

    isAlive() {
        return (this.pressure < 1000 && 5 < (64-this.pos.x+this.pos.y));
    }

    getPressure() {
        return Math.floor(this.pressure);
    }

    getWind() {
        return Math.floor(Math.pow((1013 - this.pressure), 0.9));
    }

    getRadius() {
        return Math.floor((1013 - this.pressure)*0.2);
    }

    getCasualty() {
        return this.casualty;
    }

    getCollision(imagedata: ImageData): number[] {
        const a = imagedata.data;
        const cx = Math.floor(this.pos.x);
        const cy = Math.floor(this.pos.y);
        const R = this.getRadius();
        let out = [0,0,0,0];    // [city, land, ocean, total]
        for (let dy = -R; dy <= R; dy++) {
            for (let dx = -R; dx <= R; dx++) {
                const x = cx+dx;
                const y = cy+dy;
                if (x < 0 || y < 0 || 64 <= x || 64 <= y) continue;
                const r = (dx*dx + dy*dy) / (R*R);
                if (0 < r && r <= 1) {
                    const i = 4*(64 * y + x);
                    // Now the dumbest thing.
                    // Browser changes the image color slightly
                    // so exact comparison doesn't work.
                    // We have to find which RGB component is the largest.
                    // assume the R is biggest first.
                    let k = 0;
                    let c = a[i];
                    if (c < a[i+1]) {
                        k = 1;  // no, G is bigger.
                        c = a[i+1];
                    }
                    if (c < a[i+2]) {
                        k = 2;  // no, B is bigger still.
                    }
                    out[k] += (1-r);
                    out[3] += (1-r);
                }
            }
        }
        return out;
    }

    render(ctx: CanvasRenderingContext2D) {
        const i = this.phase * 0.05;
        const cx = Math.floor(this.pos.x);
        const cy = Math.floor(this.pos.y);
        const R = this.getRadius();
        for (let dy = -R; dy <= R; dy++) {
            for (let dx = -R; dx <= R; dx++) {
                const x = cx+dx;
                const y = cy+dy;
                if (x < 0 || y < 0 || 64 <= x || 64 <= y) continue;
                const r = Math.sqrt(dx*dx + dy*dy) / R;
                if (0 < r && r <= 1) {
                    //console.info(dx, dy, r);
                    const a = Math.atan2(dy, dx) / Math.PI; // [-1, +1]
                    let c = ((1+a - i)*7 + Math.pow(r, 0.1)*50 + Math.random()) * 0.3;
                    c = c - Math.floor(c);
                    ctx.fillStyle = 'rgba(255,255,255,'+c+')';
                    ctx.fillRect(x, y, 1, 1);
                }
            }
        }
    }
}


//  Title
//
class Title extends GameScene {

    textBox: TextBox;

    onStart() {
        super.onStart();
        this.textBox = new TextBox(this.screen, FONT);
        this.textBox.lineSpace = 4;
        this.textBox.putText([
            'WE ARE TYPHOON',
            'BY EUSKE',
            'LUDUM DARE 49, "UNSTABLE"', '',
            'PRESS KEY TO START',
        ], 'center', 'center');
    }

    onKeyDown(key: number) {
        this.changeScene(new Game());
    }
    onMouseDown(p: Vec2) {
        this.changeScene(new Game());
    }

    render(ctx: CanvasRenderingContext2D) {
        super.render(ctx);
        ctx.fillStyle = 'rgb(0,0,0)';
        fillRect(ctx, this.screen);
        this.textBox.render(ctx);
    }
}

//  Game
//
class Game extends GameScene {

    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    mapData: ImageData;
    player: Typhoon;
    textBox: TextBox;
    gameOver: TextBox;
    mousePress = false;

    onStart() {
        super.onStart();
        this.canvas = createCanvas(64, 64);
        this.ctx = getEdgeyContext(this.canvas);
        this.ctx.clearRect(0, 0, 64, 64);
        this.ctx.drawImage(APP.images['map'], 0, 0, 64, 64);
        this.mapData = this.ctx.getImageData(0, 0, 64, 64);
        this.player = new Typhoon(new Vec2(1,62));
        this.textBox = new TextBox(this.screen.inflate(-4,-4), FONT);
        this.gameOver = null;
        if (!APP.hasMusic()) {
            APP.setMusic('typoon2', MP3_GAP, 12);
        }
    }

    onTick() {
        super.onTick();
        if (this.player.isAlive()) {
            this.player.onTick(this.mapData);
            this.textBox.clear();
            this.textBox.putText([
                'PRESSURE: '+this.player.getPressure()+'mb',
                'MAX WIND: '+this.player.getWind()+'mph',
                'CASUALTY: '+this.player.getCasualty(),
            ]);
        } else if (this.gameOver === null) {
            this.gameOver = new TextBox(this.screen, FONT);
            this.gameOver.putText([
                'GAME OVER', '',
                this.player.getCasualty()+' PEOPLE KILLED',
            ], 'center', 'center');
            let task = new Task();
            task.lifetime = 3;
            task.stopped.subscribe(() => { this.reset(); });
            this.add(task);
        }
    }

    onDirChanged(v: Vec2) {
        this.player.setMove(v);
    }
    onMouseDown(p: Vec2) {
        this.mousePress = true;
        this.onMouseMove(p);
    }
    onMouseMove(p: Vec2) {
        if (this.mousePress) {
            let v = p.sub(this.player.pos.scale(4));
            if (Math.abs(v.x) < 16) { v.x = 0; }
            if (Math.abs(v.y) < 16) { v.y = 0; }
            this.player.setMove(v.sign());
        }
    }
    onMouseUp(p: Vec2) {
        this.mousePress = false;
        this.player.setMove(new Vec2());
    }

    render(ctx: CanvasRenderingContext2D) {
        super.render(ctx);
        this.ctx.putImageData(this.mapData, 0, 0);
        if (this.player.isAlive()) {
            this.player.render(this.ctx);
        }
        ctx.drawImage(this.canvas, 0, 0, APP.canvas.width, APP.canvas.height);
        let v = this.player.usermove;
        if (!v.isZero()) {
            let d = (v.x == 0 || v.y == 0)? 10 : 7;
            ctx.fillStyle = 'black';
            drawArrow(ctx, new Vec2(222,222), v, d, d);
            ctx.fillStyle = 'yellow';
            drawArrow(ctx, new Vec2(220,220), v, d, d);
        }
        this.textBox.render(ctx);
        if (this.gameOver !== null) {
            this.gameOver.render(ctx);
        }
    }
}
