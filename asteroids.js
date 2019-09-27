/**
 * Asteroids!
 *
 * (a) Wil Neeley
 * (c) Code may be freely distributed under the MIT license.
 */
(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    define('asteroids', [], factory);
  } else {
    root.Asteroids = factory();
  }
})(this, function() {
  var Asteroids = function() {
    var as = {};

    // Debug mode on or off
    as.debug_mode = false;

    // Reference the asteroids scene
    as.canvas = document.getElementById('asteroids-container');

    // Stores a reference to the ship object
    as.ship = {};

    // Indicates whether or not the ship is currently destroyed
    as.ship_exploded = false;

    // Ships exploding parts
    as.ship_exploding_parts = [];

    // Stores references to active missiles
    as.missiles = [];

    // Speed at which missiles fire
    as.missile_fire_rate = 250;

    // Stores references to asteroids in the scene
    as.asteroids = [];

    // Asteroid polygon coords
    as.asteroid_coords = {
      1: [
        [-39, -25, -33, -8, -38, 21, -23, 25, -13, 39, 24, 34, 38, 7, 33, -15, 38, -31, 16, -39, -4, -34, -16, -39],
        [-32, 35, -4, 32, 24, 38, 38, 23, 31, -4, 38, -25, 14, -39, -28, -31, -39, -16, -31, 4, -38, 22],
        [12, -39, -2, -26, -28, -37, -38, -14, -21, 9, -34, 34, -6, 38, 35, 23, 21, -14, 36, -25]
      ],
      2: [
        [-7, -19, -19, -15, -12, -5, -19, 0, -19, 13, -9, 19, 12, 16, 18, 11, 13, 6, 19, -1, 16, -17],
        [9, -19, 18, -8, 7, 0, 15, 15, -7, 13, -16, 17, -18, 3, -13, -6, -16, -17],
        [2, 18, 18, 10, 8, 0, 18, -13, 6, -18, -17, -14, -10, -3, -13, 15]
      ],
      3: [
        [-8, -8, -5, -1, -8, 3, 0, 9, 8, 4, 8, -5, 1, -9],
        [-6, 8, 1, 4, 8, 7, 10, -1, 4, -10, -8, -6, -4, 0],
        [-8, -9, -5, -2, -8, 5, 6, 8, 9, 6, 7, -3, 9, -9, 0, -7]
      ]
    };

    // Direction keys asteroids can travel
    as.asteroid_dirs = ['ul', 'ur', 'dl', 'dr'];

    // Asteroids explosion particle objects
    as.asteroid_particles = [];

    // Stores references to UFOs in the scene
    as.ufos = [];

    // Reference active directional keys
    as.active_keys = {
      37: false,
      38: false,
      39: false,
      40: false
    };

    // Store current game stats
    as.stats = {
      level: 1,
      score: 0,
      score_asteroid_gain: 20,
      score_ufo_gain: 100,
      score_death_loss: 50
    };

    // Is the game active or paused?
    as.game_status = 'paused';

    /**
     * Initialize game.
     */
    as.init = function(options) {

      // Configure startup overrides (debug mode)
      as.debug_mode = options.debug_mode || false;

      // Are we going to be in nyan mode?
      as.nyan_mode = options.nyan_mode || false;

      // Nyan path override?
      as.nyan_path_override = options.nyan_path_override || '';

      // Nyan sound?
      as.nyan_sound = options.nyan_sound || false;

      // Configure game levels (REQUIRED!)
      as.levels = options.levels;

      // Configure game completed callback
      as.gameCompletedCallback = options.gameCompleted;

      // Determine the total level count
      var total_count = 0;
      for (var c in as.levels) {
        total_count += 1;
      }
      as.stats.level_count = total_count;

      // Configure canvas
      as.canvas_w = as.canvas.width;
      as.canvas_h = as.canvas.height;
      as.ctx = as.canvas.getContext('2d');
      window.addEventListener('keydown', as.shipInput);
      window.addEventListener('keyup', as.shipInput);
      as.startGameScreen();
    };

    /**
     * Game engine.
     */
    as.core = {
      throttle: function(fn, delay, scope) {
        delay || (delay = 250);
        var
          last,
          deferTimer;
        return function() {
          var
            context = scope || this,
            now = +new Date,
            args = arguments;
          if (last && now < last + delay) {
            clearTimeout(deferTimer);
            deferTimer = setTimeout(function() {
              last = now;
              fn.apply(context, args);
            }, delay);
          } else {
            last = now;
            fn.apply(context, args);
          }
        }
      },
      frame: function() {
        as.core.setDelta();
        if (!as.core.render()) return false;
        as.core.animationFrame = window.requestAnimationFrame(as.core.frame);
      },
      setDelta: function() {
        as.core.now = Date.now();
        as.core.delta = (as.core.now - as.core.then) / 1000;
        as.core.then = as.core.now;
      },
      render: function() {

        // Clear scene
        as.ctx.clearRect(0, 0, as.canvas_w, as.canvas_h);

        // Level cleared (all asteroids and UFOs destroyed)?
        if (!as.asteroids.length && !as.ufos.length) {
          window.cancelAnimationFrame(as.core.animationFrame);

          // End the game when all opponents are destroyed and all levels completed
          if (as.stats.level >= as.stats.level_count) {

            // End the game
            as.gameCompleted();
            return false;
          } else {

            // Increment game level by how many?
            as.updateLevel(1);

            // Start game and next level
            as.startGame();
          }
        }

        // Update the game score
        as.updateScore().draw();

        // Update the game level
        as.updateLevel().draw();

        // Render/handle ship interactions
        as.renderShip();

        // Render/handle UFO interactions
        as.renderUfos();

        // Render/handle asteroid interactions
        as.renderAsteroids();

        // Return true otherwise the render loop is killed
        return true;
      },
      sprite: function( options ) {
        var sprite = {
          ctx: options.ctx,
          width: options.image.width,
          height: options.image.height,
          image: options.image,
          scale: options.scale,
          w: options.image.width * options.scale,
          h: options.image.height * options.scale,
          frame_w: options.frame_w,
          frame_h: options.frame_h,
          frames: options.frames,
          frame_idx: options.frame_idx,
          frame_rate: options.frame_rate
        };

        // Update frame index at defined animation interval
        sprite.interval = setInterval(function() {
          if (as.isDirectionalKeyActive()) {
            if (sprite.frame_idx < (sprite.frames-1)) {
              sprite.frame_idx += 1;
            } else {
              sprite.frame_idx = 0;
            }
          }
        }, sprite.frame_rate);

        // Return the animating sprite object
        return sprite;
      }
    };

    /**
     * Generates ship parts.
     */
    as.explodingShipParts = function( count ) {
      for (var pidx = 0; pidx < count; pidx++) {
        var
          rand_x        = Math.ceil(Math.random() * as.ship.size * 3),
          rand_y        = Math.ceil(Math.random() * as.ship.size * 3),
          rand_angle    = Math.floor(Math.random() * 360),
          rand_turn     = Math.floor(Math.random() * 2);
        as.ship_exploding_parts.push({
          x: 0,
          y: 0,
          x2: rand_x,
          y2: rand_y,
          vx: .25,
          vy: .25,
          angle: rand_angle,
          speed: 0.05,
          alpha: 1,
          alpha_speed: 0.001,
          rotation_speed: 0.2,
          rotation_dir: rand_turn,
          draw: function() {
            as.ctx.strokeStyle = 'rgba(255, 255, 255, ' + this.alpha + ')';
            as.ctx.lineWidth = 1;

            // Rotate exploding parts
            if (this.rotation_dir) {
              this.angle -= this.rotation_speed;
            } else {
              this.angle += this.rotation_speed;
            }
            if (this.angle > 360) this.angle = 0;
            if (this.angle < 0) this.angle = 360;
            as.ctx.save();
            as.ctx.translate(this.x, this.y);
            as.ctx.rotate((Math.PI / 180 * (this.angle)));
            as.ctx.translate(-this.x, -this.y);

            // Draw ship part
            as.ctx.beginPath();
            as.ctx.moveTo(this.x, this.y);
            as.ctx.lineTo(this.x + this.x2, this.y + this.y2);
            as.ctx.closePath();
            as.ctx.stroke();
            as.ctx.restore();
          }
        });
      }
    };

    /**
     * Generates asteroid particles.
     */
    as.explodingAsteroidParticles = function( count ) {
      as.asteroid_particles = [];
      for (var pidx = 0; pidx < count; pidx++) {
        as.asteroid_particles.push({
          x: 0,
          y: 0,
          radius: 1,
          vx: .25,
          vy: .25,
          speed: 0.05,
          alpha: 1,
          alpha_speed: 0.001,
          draw: function() {
            as.ctx.fillStyle = 'rgba(255, 255, 255, ' + this.alpha + ')';
            as.ctx.beginPath();
            as.ctx.arc(this.x, this.y, this.radius, 0, 360);
            as.ctx.closePath();
            as.ctx.fill();
          }
        });
      }
    };

    /**
     * Generate the ship.
     */
    as.createShip = function() {
      as.ship = {
        x: as.canvas_w / 2,
        y: as.canvas_h / 2,
        vx: 0,
        vy: 0,
        vx2: 0,
        vy2: 0,
        turn: 5,
        speed: 2.4,
        friction: 0.99,
        size: 10,
        color: 'rgba(255, 255, 255, 1)',
        angle: 0,
        rx: 0,
        ry: 0,
        radius: 0,
        draw: function() {
          as.ctx.strokeStyle = this.color;
          as.ctx.fillStyle = this.color;
          as.ctx.lineWidth = 2;
          as.ctx.beginPath();

          // Rotate the ship
          if (this.angle > 360) this.angle = 0;
          if (this.angle < 0) this.angle = 360;
          as.ctx.save();
          as.ctx.translate(this.x, this.y);
          as.ctx.rotate((Math.PI / 180 * (this.angle)));
          as.ctx.translate(-this.x, -this.y);

          // Rotate around center of ship
          // @todo - should I deal with this?
          //as.ctx.translate((this.x + (this.size * 1.5)), this.y);
          //as.ctx.translate(-(this.x + (this.size * 1.5)), -this.y);

          // Sides
          as.ctx.moveTo(this.x + this.size * 3, this.y + this.size);
          as.ctx.lineTo(this.x, this.y);
          as.ctx.lineTo(this.x + this.size * 3, this.y - this.size);

          // Back
          as.ctx.moveTo((this.x + this.size * 3) - 5, (this.y + this.size) - 2);
          as.ctx.lineTo((this.x + this.size * 3) - 5, (this.y - this.size) + 2);

          // Draw ship's outline
          as.ctx.closePath();
          as.ctx.stroke();

          // Draw thruster
          if (as.isDirectionalKeyActive()) {
            var thrust_x = (this.x + this.size * 3) - 5;
            var thrust_y = this.y;
            as.ctx.beginPath();
            as.ctx.moveTo(thrust_x, thrust_y);
            as.ctx.lineTo(thrust_x + 10, thrust_y);
            as.ctx.lineTo(thrust_x, thrust_y - 4);
            as.ctx.moveTo(thrust_x, thrust_y);
            as.ctx.lineTo(thrust_x + 10, thrust_y);
            as.ctx.lineTo(thrust_x, thrust_y + 4);
            as.ctx.closePath();
            as.ctx.fill();
          }

          // Update collision circle info
          this.rx = this.x + 15;
          this.ry = this.y;
          this.radius = this.size * 2;

          // Draw collision rectangle around ship
          if (as.debug_mode) {
            as.ctx.strokeStyle = 'red';
            as.ctx.lineWidth = 2;
            as.ctx.beginPath();
            as.ctx.arc(this.rx, this.ry, this.radius, 0, 360);
            as.ctx.closePath();
            as.ctx.stroke();
          }

          // Restore transformation state
          as.ctx.restore();
        }
      };
    };

    /**
     * Generate a cute little stick figure kitty ship.
     */
    as.createNyan = function() {
        as.ship = {
          x: as.canvas_w / 2,
          y: as.canvas_h / 2,
          vx: 0,
          vy: 0,
          vx2: 0,
          vy2: 0,
          turn: 5,
          speed: 2.4,
          friction: 0.99,
          size: 14,
          color: 'rgba(255, 255, 0, 1)',
          angle: 0,
          rx: 0,
          ry: 0,
          radius: 0,
          nyan: null,
          draw: function() {

            // Rotate the ship
            if (this.angle > 360) this.angle = 0;
            if (this.angle < 0) this.angle = 360;
            as.ctx.save();
            as.ctx.translate(this.x, this.y);
            as.ctx.rotate((Math.PI / 180 * (this.angle)));
            as.ctx.translate(-this.x, -this.y);

            // Draw thruster
            if (as.isDirectionalKeyActive() && this.nyan) {
              var thrust_x = (this.x + this.nyan.frame_w) - 10;
              var thrust_y = this.y - 7;
              var bow_size = 2.3;
              var bow_seg_size = 12;

              // Play the annoying nyan sound track
              if (as.nyan_sound) this.nyan.sound.play();

              // Create offset line segments
              for (var i = 0; i <= 2; i++) {
                var even = i == i ? !(i%2) : 0;
                var bow_offset = ((even) ? (bow_size / 2) : 0);
                var timestamp = Date.now();
                var timestamp_even = timestamp == timestamp ? !(timestamp%2) : 0;
                if (timestamp_even) bow_offset = bow_offset * -1;

                // Red
                as.ctx.beginPath();
                as.ctx.fillStyle = 'rgba(255, 0, 0, 1)';
                as.ctx.rect(thrust_x + (i * bow_seg_size), thrust_y + bow_offset, bow_seg_size, bow_size);
                as.ctx.fill();
                as.ctx.closePath();

                // Orange
                as.ctx.beginPath();
                as.ctx.fillStyle = 'rgba(255, 153, 0, 1)';
                as.ctx.rect( thrust_x + (i * bow_seg_size), thrust_y + (bow_size) + bow_offset, bow_seg_size, bow_size);
                as.ctx.fill();
                as.ctx.closePath();

                // Yellow
                as.ctx.beginPath();
                as.ctx.fillStyle = 'rgba(255, 255, 0, 1)';
                as.ctx.rect( thrust_x + (i * bow_seg_size), thrust_y + (bow_size * 2) + bow_offset, bow_seg_size, bow_size);
                as.ctx.fill();
                as.ctx.closePath();

                // Green
                as.ctx.beginPath();
                as.ctx.fillStyle = 'rgba(51, 255, 0, 1)';
                as.ctx.rect( thrust_x + (i * bow_seg_size), thrust_y + (bow_size * 3) + bow_offset, bow_seg_size, bow_size);
                as.ctx.fill();
                as.ctx.closePath();

                // Blue
                as.ctx.beginPath();
                as.ctx.fillStyle = 'rgba(0, 153, 255, 1)';
                as.ctx.rect( thrust_x + (i * bow_seg_size), thrust_y + (bow_size * 4) + bow_offset, bow_seg_size, bow_size);
                as.ctx.fill();
                as.ctx.closePath();

                // Purple
                as.ctx.beginPath();
                as.ctx.fillStyle = 'rgba(102, 51, 255, 1)';
                as.ctx.rect( thrust_x + (i * bow_seg_size), thrust_y + (bow_size * 5) + bow_offset, bow_seg_size, bow_size);
                as.ctx.fill();
                as.ctx.closePath();
              }
            } else if (this.nyan && as.nyan_sound) {
              this.nyan.sound.pause();
            }

            // Create the kitty sprite if it doesn't yet exist.
            if (!this.nyan) {

              // Create nyan sprite
              var nyanImage = new Image();
              nyanImage.src = as.nyan_path_override + 'assets/dag-sprite-sheet.png';
              this.nyan = as.core.sprite({
                ctx: as.ctx,
                width: 100,
                height: 100,
                image: nyanImage,
                scale: 1,
                frame_w: 36,
                frame_h: 20,
                frames: 1,
                frame_idx: 0,
                frame_rate: 100
              });

              // Only create sound player when instructed
              if (as.nyan_sound) {
                
                // Create nyan sound file
                this.nyan.sound = document.createElement('audio');
                if (this.nyan.sound.canPlayType('audio/mpeg') != '') {
                  this.nyan.sound.src = as.nyan_path_override + 'assets/nyanlooped.mp3';
                } else {
                  this.nyan.sound.src = as.nyan_path_override + 'assets/nyanlooped.ogg';
                }

                // Handle nyan sound event
                this.nyan.sound.addEventListener('ended', function() {
                  // See: http://forestmist.org/2010/04/html5-audio-loops/
                  this.currentTime = 0;
                }, false);

                // Append the sound track element
                document.body.appendChild(this.nyan.sound);
              }
            }

            // Draw nyan
            var sprite_x = this.x;
            var sprite_y = this.y - 10;
            as.ctx.drawImage(
              this.nyan.image,
              this.nyan.frame_w * this.nyan.frame_idx,
              0,
              this.nyan.frame_w,
              this.nyan.frame_h,
              sprite_x,
              sprite_y,
              this.nyan.frame_w,
              this.nyan.frame_h
            );

            // Update collision circle info
            this.rx = this.x + 15;
            this.ry = this.y;
            this.radius = this.size;

            // Draw collision rectangle around ship
            if (as.debug_mode) {
              as.ctx.strokeStyle = 'red';
              as.ctx.lineWidth = 2;
              as.ctx.beginPath();
              as.ctx.arc(this.rx, this.ry, this.radius, 0, 360);
              as.ctx.closePath();
              as.ctx.stroke();
            }

            // Restore transformation state
            as.ctx.restore();
          }
        }
    },

    /**
     * Handle ship's keyboard input.
     */
    as.shipInput = function(e) {
      e.preventDefault();

      // Update active keys
      as.active_keys[e.keyCode] = e.type == 'keydown';

      // Create a missile for firing
      if (e.type == 'keydown' && e.keyCode == 32) {
        if (!this.missileThrottle) {
          this.missileThrottle = as.core.throttle(function() {
            as.createMissile(as.ship);
          }, as.missile_fire_rate);
        }
        this.missileThrottle();
      }

      // Reveal the ship after an explosion
      as.ship_exploded = false;
      as.ship.color = (as.nyan_mode) ? 'yellow' : 'white';
    };

    /**
     * Creates a missile pointing the direction the ship is pointing.
     */
    as.createMissile = function( object ) {
      as.missiles.push({
        x: object.x,
        y: object.y,
        x2: 0,
        y2: 0,
        r1: as.canvas_w,
        r2: 6,
        rx: 0,
        ry: 0,
        radius: 4,
        color: 'white',
        fired_from: object.angle ? 'ship' : 'ufo',
        theta: (180 + object.angle || Math.floor(Math.random() * 360)) % 360,
        draw: function() {
          this.x2 = this.x + this.r2 * Math.cos(Math.PI * this.theta / 180);
          this.y2 = this.y + this.r2 * Math.sin(Math.PI * this.theta / 180);
          as.ctx.strokeStyle = this.color;
          as.ctx.lineWidth = 4;
          as.ctx.beginPath();
          as.ctx.moveTo(this.x, this.y);
          as.ctx.lineTo(this.x2, this.y2);
          as.ctx.stroke();
          this.x = this.x2;
          this.y = this.y2;

          // Update collision circle
          this.rx = this.x;
          this.ry = this.y;

          // Draw collision rectangle around ship
          if (as.debug_mode) {
            as.ctx.strokeStyle = 'red';
            as.ctx.lineWidth = 2;
            as.ctx.beginPath();
            as.ctx.arc(this.rx, this.ry, this.radius, 0, 360);
            as.ctx.closePath();
            as.ctx.stroke();
          }
        }
      });
    };

    /**
     * Generates asteroids.
     */
    as.createAsteroids = function( count, size, start_x, start_y, direction ) {
      var
        size_min        = 1,
        size_max        = 3,
        ast_len         = as.asteroids.length,
        rot_speeds      = [.25, .45, .65];

      // Generate asteroids
      for (var i = ast_len; i < (ast_len + count); i++) {
        var
          ast_size        = size || Math.floor(Math.random() * (size_max - size_min + 1)) + size_min,
          x               = start_x || Math.floor(Math.random() * as.canvas_w),
          y               = start_y || Math.floor(Math.random() * as.canvas_h),
          dir             = direction || as.getRandomDirection(),
          coord_set       = as.asteroid_coords[ast_size],
          coords          = coord_set[Math.floor(Math.random() * (coord_set.length))],
          rotation_dir    = Math.floor(Math.random() * 2);

        // Correct for asteroids not randomly placed in perimeter region
        if (!start_x && !start_y) {
          var
            x_side        = (x > as.canvas_w * .15 && x < as.canvas_w * .85),
            y_side        = (y > as.canvas_h * .15 && y < as.canvas_h * .85),
            x_pos         = x,
            y_pos         = y;

          // X coord not in perimeter region
          if (x_side) {
            if (Math.floor(Math.random() * 2)) {
              x_pos = Math.floor(Math.random() * (as.canvas_w * .15));
            } else {
              x_pos = Math.floor(Math.random() * (as.canvas_w - (as.canvas_w * .85))) + (as.canvas_w * .85);
            }
          }

          // Y coord not in perimeter region
          if (y_side) {
            if (Math.floor(Math.random() * 2)) {
              y_pos = Math.floor(Math.random() * (as.canvas_h * .15));
            } else {
              y_pos = Math.floor(Math.random() * (as.canvas_h - (as.canvas_h * .85))) + (as.canvas_h * .85);
            }
          }

          // Reposition only when both aren't in perimeter region
          if (x_side && y_side) {
            x = x_pos;
            y = y_pos;
          }
        }

        // Store new asteroid
        as.asteroids.push({
          id: i,
          x: x,
          y: y,
          vx: 1,
          vy: 1,
          dir: dir,
          size: ast_size,
          color: 'white',
          coord_set_idx: ast_size,
          coords: coords,
          radius: 30,
          rx: 0,
          ry: 0,
          angle: 0,
          rotation_speed: rot_speeds[ast_size-1],
          rotation_dir: rotation_dir,
          draw: function() {
            as.ctx.lineWidth = 2;
            as.ctx.strokeStyle = this.color;

            // Rotate the ship
            if (this.angle > 360) this.angle = 0;
            if (this.angle < 0) this.angle = 360;
            as.ctx.save();
            as.ctx.translate(this.x, this.y);
            as.ctx.rotate((Math.PI / 180 * (this.angle)));
            as.ctx.translate(-this.x, -this.y);
            if (this.rotation_dir) {
              this.angle += this.rotation_speed;
            } else {
              this.angle -= this.rotation_speed;
            }

            // Draw the asteroid
            as.ctx.beginPath();
            as.ctx.moveTo(this.x, this.y);
            for (var aidx = 0; aidx < this.coords.length; aidx+=2) {
              as.ctx.lineTo(this.x + this.coords[aidx], this.y + this.coords[aidx+1]);
            }
            as.ctx.closePath();
            as.ctx.stroke();
            as.ctx.restore();

            // Update collision circle info based on asteroid size
            this.rx = this.x;
            this.ry = this.y;
            switch (this.coord_set_idx) {
              case 1 :
                this.radius = 40;
                this.vx = .5;
                this.vy = .5;
                break;
              case 2 :
                this.radius = 22;
                this.vx = 1;
                this.vy = 1;
                break;
              case 3 :
                this.radius = 12;
                this.vx = 1.5;
                this.vy = 1.5;
                break;
            }

            // Draw collision circle around ship
            if (as.debug_mode) {
              as.ctx.strokeStyle = 'red';
              as.ctx.lineWidth = 2;
              as.ctx.beginPath();
              as.ctx.arc(this.rx, this.ry, this.radius, 0, 360);
              as.ctx.closePath();
              as.ctx.stroke();
            }
          }
        });
      }
    };

    /**
     * Creates a UFO enemy.
     */
    as.createUfo = function( count ) {
      for (var i = 0; i < count; i++) {
        var
          start_x       = Math.floor(Math.random() * as.canvas_w),
          start_y       = Math.floor(Math.random() * as.canvas_h),
          rand_dir      = Math.floor(Math.random() * 2),
          move_points   = [];

        // Place starting location off screen
        if (rand_dir) {
          start_x += (as.canvas_h * 2);
          start_y += (as.canvas_h * 2);
        } else {
          start_x -= (as.canvas_h * 2);
          start_y -= (as.canvas_h * 2);
        }

        // Generate movement points
        for (var n = 0; n < 8; n++) {
          var
            mov_x       = Math.floor(Math.random() * as.canvas_w),
            mov_y       = Math.floor(Math.random() * as.canvas_h);
          move_points.push({x: mov_x, y: mov_y});
        }

        // Add UFO to list
        as.ufos.push({
          id: i,
          x: start_x,
          y: start_y,
          vx: 0,
          vy: 0,
          vx2: 0,
          vy2: 0,
          rx: 0,
          ry: 0,
          speed: 6,
          radius: 30,
          color: 'white',
          move_points: move_points,
          curr_point: 0,
          destroyed: false,
          paused: false,
          pauseMovement: function() {
            var
              level         = as.levels[as.stats.level],
              ufo_ctx       = this,
              rand_pause    = Math.floor(Math.random() * (level.ufo_max_pause_time - level.ufo_min_pause_time) + level.ufo_min_pause_time);
            setTimeout(function() {
              ufo_ctx.paused = false;
            }, rand_pause);
          },
          fireMissiles: function() {
            var
              level         = as.levels[as.stats.level],
              ufo_ctx       = this;
            this.missileThrottle = this.missileThrottle || as.core.throttle(function() {
                if (!ufo_ctx.destroyed) {
                  as.createMissile(this);
                }
              }, level.ufo_missile_fire_rate);
            this.missileThrottle();
          },
          draw: function() {
            as.ctx.lineWidth = 2;
            as.ctx.strokeStyle = this.color;

            // Dome
            as.ctx.beginPath();
            as.ctx.arc(this.x, this.y, this.radius-10, (Math.PI/180)*180, (Math.PI/180)*360, false);
            as.ctx.quadraticCurveTo(this.x, this.y+10, this.x-20, this.y);

            // Saucer
            as.ctx.moveTo(this.x-(this.radius-10), this.y);
            as.ctx.bezierCurveTo(
              this.x-(this.radius * 2), this.y+24,
              this.x+(this.radius * 2), this.y+24,
              this.x+20, this.y+1
            );

            // Saucer windows
            as.ctx.moveTo(this.x-18, this.y+9);
            as.ctx.arc(this.x-18, this.y+9, 3, 0, 360);
            as.ctx.moveTo(this.x, this.y+12);
            as.ctx.arc(this.x, this.y+12, 3, 0, 360);
            as.ctx.moveTo(this.x+18, this.y+9);
            as.ctx.arc(this.x+18, this.y+9, 3, 0, 360);

            // Draw UFO
            as.ctx.closePath();
            as.ctx.stroke();

            // Update collision coords
            this.rx = this.x;
            this.ry = this.y;

            // Draw collision circle around ship
            if (as.debug_mode) {
              as.ctx.strokeStyle = 'red';
              as.ctx.lineWidth = 2;
              as.ctx.beginPath();
              as.ctx.arc(this.x, this.y, this.radius, 0, 360);
              as.ctx.closePath();
              as.ctx.stroke();
            }
          }
        });
      }
    };

    /**
     * Detects if an asteroid has gone out of the scene.
     */
    as.asteroidOutOfBounds = function( asteroid ) {
      switch (true) {
        case ((asteroid.y + asteroid.radius) < 0) :
          asteroid.y = as.canvas_h;
          break;
        case (asteroid.y - asteroid.radius > as.canvas_h) :
          asteroid.y = -asteroid.radius;
          break;
        case ((asteroid.x + asteroid.radius) < 0) :
          asteroid.x = as.canvas_w;
          break;
        case (asteroid.x - asteroid.radius > as.canvas_w) :
          asteroid.x = -asteroid.radius;
          break;
      }
    };

    /**
     * Detects if the ship has gone out of the scene.
     */
    as.shipOutOfBounds = function( ship ) {
      switch (true) {
        case ((ship.y + (ship.radius * 2)) < 0) :
          ship.y = as.canvas_h;
          break;
        case (ship.y - (ship.radius * 2) > as.canvas_h) :
          ship.y = -ship.radius;
          break;
        case ((ship.x + (ship.radius * 2)) < 0) :
          ship.x = as.canvas_w;
          break;
        case (ship.x - (ship.radius * 2) > as.canvas_w) :
          ship.x = -ship.radius;
          break;
      }
    };

    /**
     * A general circle collision detection method.
     */
    as.isCircleCollision = function( obj1, obj2 ) {
      var
        dx        = obj1.rx - obj2.rx,
        dy        = obj1.ry - obj2.ry,
        dist      = Math.sqrt(dx * dx + dy * dy);
      if (dist < obj1.radius + obj2.radius) {
        return true;
      }
    };

    /**
     * Returns a string indicating the opposite direction.
     */
    as.getOppositeDirection = function( direction ) {
      switch (direction) {
        case 'ul' :
          return 'dr';
          break;
        case 'ur' :
          return 'dl';
          break;
        case 'dl' :
          return 'ur';
          break;
        case 'dr' :
          return 'ul';
          break;
      }
    };

    /**
     * Returns a string indicating the vertical opposite direction.
     */
    as.getOppositeVerticalDirection = function( direction ) {
      switch (direction) {
        case 'ul' :
          return 'dl';
          break;
        case 'ur' :
          return 'dr';
          break;
        case 'dl' :
          return 'ul';
          break;
        case 'dr' :
          return 'ur';
          break;
      }
    };

    /**
     * Returns a random string indicating direction.
     */
    as.getRandomDirection = function() {
      var
        ridx        = Math.floor(Math.random() * as.asteroid_dirs.length);
      return as.asteroid_dirs[ridx];
    };

    /**
     * Returns true when user is pressing a directional key.
     */
    as.isDirectionalKeyActive = function() {
      if (as.active_keys['37'] || as.active_keys['38'] || as.active_keys['39'] || (as.active_keys['40'])) return true;
    };

    /**
     * Handles generating new asteroids based on an asteroid "explosion".
     */
    as.asteroidExplosion = function( asteroid ) {
      var
        rand_num          = Math.floor(Math.random() * 3) + 1,
        rand_dist         = function() {
          return Math.floor(Math.random() * 30);
        };

      // Generate random number of new asteroids
      for (var idx = 0; idx < rand_num; idx++) {
        if (asteroid.size == 1) {
          if (idx % 2) {
            as.createAsteroids(1, 2, asteroid.x-rand_dist(), asteroid.y-rand_dist(), as.getRandomDirection());
          } else {
            as.createAsteroids(1, 2, asteroid.x+rand_dist(), asteroid.y-rand_dist(), as.getRandomDirection());
          }
        }
        else if (asteroid.size == 2) {
          if (idx % 2) {
            as.createAsteroids(1, 3, asteroid.x-rand_dist(), asteroid.y-rand_dist(), as.getRandomDirection());
          } else {
            as.createAsteroids(1, 3, asteroid.x-rand_dist(), asteroid.y+rand_dist(), as.getRandomDirection());
          }
        }
      }

      // Delete exploded asteroid
      as.asteroids.splice(as.asteroids.indexOf(asteroid), 1);
    };

    /**
     * Detect and handle ship explosion.
     */
    as.detectShipExplosion = function( object ) {
      if (as.isCircleCollision(object, as.ship) && !as.ship_exploding_parts.length && !as.ship_exploded) {
        as.ship_exploded = true;

        // Hide the ship
        as.ship.color = 'rgba(0,0,0,0)';

        // Generate some exploding ship parts
        as.explodingShipParts(6);

        // Decrease score
        as.stats.score -= as.stats.score_death_loss;

        // Update initial parts properties
        for (var spidx in as.ship_exploding_parts) {
          var
            part = as.ship_exploding_parts[spidx],
            rand_angle = Math.floor(Math.random() * 360),
            rand_speed = Math.random() * .1;
          part.x = as.ship.x;
          part.y = as.ship.y;
          part.speed = rand_speed;
          part.vx = part.speed * Math.cos(rand_angle * Math.PI / 180.0);
          part.vy = part.speed * Math.sin(rand_angle * Math.PI / 180.0);
          part.draw();
        }

        // Show ship color as red
        setTimeout(function() {
          as.ship.color = 'red';
        }, 1000);
      }
    };

    /**
     * Render/handle the asteroids and their interactions.
     */
    as.renderAsteroids = function() {
      for (var idx in as.asteroids) {
        var asteroid = as.asteroids[idx];

        // Handle asteroid going off screen
        as.asteroidOutOfBounds(asteroid);

        // Detect ship/asteroid collisions
        as.detectShipExplosion(asteroid);

        // Animate exploding ship parts
        for (var spidx in as.ship_exploding_parts) {
          var part = as.ship_exploding_parts[spidx];
          part.x += part.vx;
          part.y += part.vy;
          part.alpha -= part.alpha_speed;
          part.draw();
          if (part.alpha <= 0) as.ship_exploding_parts.splice(pidx, 1);
        }

        // Detect asteroid/missile collisions (fired from ship & UFOs)
        for (var midx in as.missiles) {
          var missile = as.missiles[midx];

          // Detect exploding asteroids
          if (as.isCircleCollision(asteroid, missile)) {
            asteroid.color = 'red';

            // Add to max score
            if (missile.fired_from == 'ship') {
              as.stats.score += as.stats.score_asteroid_gain;
            }

            // Delete out of bound missiles
            as.missiles.splice(midx, 1);

            // Handle asteroid missile impact
            as.asteroidExplosion(asteroid);

            // Generate some explosion particles
            as.explodingAsteroidParticles(5);

            // Update initial particle properties
            if (as.asteroid_particles.length) {
              for (var pidx in as.asteroid_particles) {
                var
                  particle        = as.asteroid_particles[pidx],
                  rand_angle      = Math.floor(Math.random() * 360),
                  rand_speed      = Math.random() * .1;
                particle.x = asteroid.x;
                particle.y = asteroid.y;
                particle.speed = rand_speed;
                particle.vx = particle.speed * Math.cos(rand_angle * Math.PI / 180.0);
                particle.vy = particle.speed * Math.sin(rand_angle * Math.PI / 180.0);
                particle.draw();
              }
            }
          }
        }

        // Animate explosion particles
        for (var pidx in as.asteroid_particles) {
          var particle = as.asteroid_particles[pidx];
          particle.x += particle.vx;
          particle.y += particle.vy;
          particle.alpha -= particle.alpha_speed;
          particle.draw();
          if (particle.alpha <= 0) as.asteroid_particles.splice(pidx, 1);
        }

        // Detect asteroid/asteroid collisions
        for (var aidx in as.asteroids) {
          var asteroid2 = as.asteroids[aidx];
          if (as.isCircleCollision(asteroid, asteroid2)) {
            asteroid.dir = as.getOppositeVerticalDirection(asteroid.dir);
            asteroid2.dir = as.getOppositeVerticalDirection(asteroid2.dir);
          }
        }

        // Animate asteroids
        asteroid.draw();
        switch (asteroid.dir) {
          case 'ul' :
            asteroid.x -= asteroid.vx - as.levels[as.stats.level].asteroid_speed;
            asteroid.y -= asteroid.vy - as.levels[as.stats.level].asteroid_speed;
            break;
          case 'ur' :
            asteroid.x += asteroid.vx + -as.levels[as.stats.level].asteroid_speed;
            asteroid.y -= asteroid.vy - as.levels[as.stats.level].asteroid_speed;
            break;
          case 'dl' :
            asteroid.x -= asteroid.vx - as.levels[as.stats.level].asteroid_speed;
            asteroid.y += asteroid.vy + -as.levels[as.stats.level].asteroid_speed;
            break;
          case 'dr' :
            asteroid.x += asteroid.vx + -as.levels[as.stats.level].asteroid_speed;
            asteroid.y += asteroid.vy + -as.levels[as.stats.level].asteroid_speed;
            break;
        }
      }
    };

    /**
     * Render/handle the ship and its interactions.
     */
    as.renderShip = function() {

      // Move ship up
      if (as.active_keys['38']) {

        // Ship to fly towards angle it is pointing. Calculate coords in distance
        var theta = (180 + as.ship.angle) % 360;
        as.ship.vx2 = as.ship.x - (as.ship.x + as.ship.speed * Math.cos(Math.PI * theta / 180));
        as.ship.vy2 = as.ship.y - (as.ship.y + as.ship.speed * Math.sin(Math.PI * theta / 180));
      }

      // Apply ship friction to velocity
      as.ship.vx2 *= as.ship.friction;
      as.ship.vy2 *= as.ship.friction;
      as.ship.x -= as.ship.vx2;
      as.ship.y -= as.ship.vy2;

      // Rotate ship left
      if (as.active_keys['37']) {
        as.ship.angle -= as.ship.turn;
      }

      // Rotate ship right
      if (as.active_keys['39']) {
        as.ship.angle += as.ship.turn;
      }

      // Draw ship
      as.shipOutOfBounds(as.ship);
      as.ship.draw();

      // Draw ship's firing missiles
      for (var midx in as.missiles) {
        var missile = as.missiles[midx];
        missile.draw();

        // Explode UFO fired missile on ship
        if (missile.fired_from == 'ufo') {
          as.detectShipExplosion(missile);
        }

        // Delete missile when off screen
        if (
          missile.x >= as.canvas_w ||
          missile.x <= 0 ||
          missile.y >= as.canvas_h ||
          missile.y <= 0
        ) {
          as.missiles.splice(midx, 1);
        }
      }
    };

    /**
     * Render/handle each level's UFOs and its interactions.
     */
    as.renderUfos = function() {
      var
        level         = as.levels[as.stats.level];

      // Create UFOs if non have been deployed
      if (!level.ufos_deployed) {
        level.ufos_deployed = true;
        as.createUfo(level.ufos);
      }

      // Draw UFOs when active
      for (var uidx in as.ufos) {
        var
          ufo     = as.ufos[uidx],
          dest    = ufo.move_points[ufo.curr_point];

        // Move the UFO to its target point
        if (!ufo.paused) {
          var
            angle   = Math.atan2(ufo.y - dest.y, ufo.x - dest.x) * 180 / Math.PI,
            theta   = (180 + angle) % 360;

          // Set UFO speed
          ufo.speed = level.ufo_speed;

          // Animate until ship reaches area of destination
          if (!((ufo.x > dest.x - 20) && (ufo.x < dest.x + 20))) {

            // Fly UFO towards its destination
            ufo.vx2 = ufo.x - (ufo.x + ufo.speed * Math.cos(Math.PI * theta / 180));
            ufo.vy2 = ufo.y - (ufo.y + ufo.speed * Math.sin(Math.PI * theta / 180));
            ufo.x -= ufo.vx2;
            ufo.y -= ufo.vy2;
          }

          // Pause the UFO's movement and get it ready to move to the next point
          else {
            ufo.paused = true;
            if (ufo.curr_point == ufo.move_points.length-1) {
              ufo.curr_point = 0;
            } else {
              ufo.curr_point++;
            }

            // Call UFO movement timeout method
            ufo.pauseMovement();
          }
        }

        // Initialize firing of UFO missiles
        ufo.fireMissiles();

        // Draw UFO
        ufo.draw();

        // Detect ship/ufo collisions
        as.detectShipExplosion(ufo);

        // Detect ufo/missile collisions
        for (var midx in as.missiles) {
          var missile = as.missiles[midx];

          // Detect missiles hitting UFO
          if (as.isCircleCollision(ufo, missile) && missile.fired_from == 'ship') {
            ufo.color = 'rgba(0, 0, 0, 0)';

            // Mark the UFO as destroyed
            ufo.destroyed = true;

            // Delete UFO.
            as.ufos.splice(uidx, 1);

            // Add to max score
            as.stats.score += as.stats.score_ufo_gain;

            // Delete out of bound missiles
            as.missiles.splice(midx, 1);

            // Generate/update some explosion particles
            as.explodingAsteroidParticles(5);

            // Update initial particle properties
            for (var pidx in as.asteroid_particles) {
              var
                particle        = as.asteroid_particles[pidx],
                rand_angle      = Math.floor(Math.random() * 360),
                rand_speed      = Math.random() * .1;
              particle.x = ufo.x;
              particle.y = ufo.y;
              particle.speed = rand_speed;
              particle.vx = particle.speed * Math.cos(rand_angle * Math.PI / 180.0);
              particle.vy = particle.speed * Math.sin(rand_angle * Math.PI / 180.0);
              particle.draw();
            }
          }
        }
      }
    };

    /**
     * Updates game score.
     */
    as.updateScore = function( points ) {
      if (points) {
        as.stats.score += points;
      }
      return {
        draw: function() {
          var
            str             = "",
            str_width       = null,
            pad             = 30,
            prepend         = '',
            negative        = false;
          if (as.stats.score < 0) {
            negative = true;
          }
          for (var i = 0; i < (10 - as.stats.score.toString().replace("-", "").length); i++) {
            prepend = prepend + "" + '0';
          }
          str += prepend + as.stats.score.toString().replace("-", "");
          if (negative) str = "-" + str;
          str = "SCORE: " + str;
          str_width = as.ctx.measureText(str);
          as.ctx.font = "16px courier";
          as.ctx.fillStyle = 'white';
          as.ctx.fillText(str, (str_width.width / 2) + pad, pad);
        }
      }
    };

    /**
     * Updates the game level.
     */
    as.updateLevel = function( level ) {
      if (level) {
        as.stats.level += level;
      }
      return {
        draw: function() {
          var
            str             = "LEVEL: " + as.stats.level,
            str_width       = as.ctx.measureText(str),
            pad             = 30;
          if (!as.levels[as.stats.level].start_time) {
            as.levels[as.stats.level].start_time = Date.now();
          }
          as.ctx.font = "16px courier";
          as.ctx.fillStyle = 'white';
          as.ctx.fillText(str, as.canvas.width - (str_width.width / 2) - pad, pad);
        }
      }
    };

    /**
     * Start the game.
     */
    as.startGameScreen = function() {
      var
        game_slide_index        = 0,
        game_slides             = [
          {
            duration: 5000,
            text: "Press SPACEBAR to start the game!"
          },
          {
            duration: 5000,
            text: "Use ARROW keys to move and SPACE to fire."
          }
        ],
        slideViewer             = function( id ) {
          var
            slide_obj       = game_slides[id];

          // Update tracking index
          if (id == game_slides.length-1) {
            game_slide_index = 0;
          } else {
            game_slide_index++;
          }

          // Add current slide
          as.ctx.clearRect(0, 0, as.canvas_w, as.canvas_h);
          as.ctx.font = "16px courier";
          as.ctx.fillStyle = 'white';
          as.ctx.textBaseline = 'middle';
          as.ctx.textAlign = "center";
          as.ctx.fillText(slide_obj.text, (as.canvas.width / 2), (as.canvas_h / 2));

          // Initialize next slide after duration
          setTimeout(function() {
            if (as.game_status == 'paused') {
              slideViewer(game_slide_index);
            }
          }, slide_obj.duration);
        };

      // Initialize the pre game slides
      if (as.game_status == 'paused') {
        slideViewer(0);
      }

      // Attach game start event listener
      window.addEventListener("keydown", function(e) {
        if (e.keyCode == 32 && as.game_status == 'paused') {
          as.game_status = 'active';
          as.startGame();
        }
      });
    };

    /**
     * Start/restart the game
     */
    as.startGame = function() {
      as.core.then = Date.now();
      as.createAsteroids(as.levels[as.stats.level].asteroids);
      if (as.nyan_mode) {
        as.createNyan();
      } else {
        as.createShip();
      }
      as.core.frame();
    };

    /**
     * A callback to execute when the game is completed.
     */
    as.gameCompleted = function() {

      // Clear scene/add game over message
      as.ctx.clearRect(0, 0, as.canvas_w, as.canvas_h);
      as.ctx.font = "16px courier";
      as.ctx.fillStyle = 'white';
      as.ctx.textBaseline = 'middle';
      as.ctx.textAlign = "center";
      as.ctx.fillText('Game completed!', (as.canvas.width / 2), (as.canvas_h / 2));
      as.ctx.fillText('Your score: ' + as.stats.score, (as.canvas.width / 2), (as.canvas_h / 2) + 30);

      // Kill the animation sequence
      window.cancelAnimationFrame(as.core.animationFrame);

      // Game completed user callback
      if (typeof as.gameCompletedCallback == 'function') {
        as.gameCompletedCallback();
      }
    };

    return as;
  };

  return Asteroids;
});
