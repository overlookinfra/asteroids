# Asteroids! ... Or something kind of like it.

# Introduction

In my free time I coded a version of Asteroids using JavaScript and the 
canvas element. This was just a little experiment so it's unlikely I'll
improve it much more. I'm posting it on GitHub in case anyone finds any
of the bits of code useful. Programming Asteroids is a really great way
to get started understanding the basics of 2D video games. Enjoy!

View [demo](http://boilerjs.com/misc/asteroids/asteroids.html).

## Up and running

Include the asteroids.js file in the header of your page and add a canvas
element with an id of `asteroids-container`, like this:

```
 <canvas id="asteroids-container" width="800" height="400"></canvas>
```

Then include the following script to initialize the game.

```
<script>
    var asteroids = new Asteroids();
    asteroids.init({
        debug_mode: true,
        levels: {
            1: {
                asteroids: 3,
                asteroid_speed: 1,
                ufos: 2,
                ufo_speed: 2,
                ufo_min_pause_time: 1000,
                ufo_max_pause_time: 3000,
                ufo_missile_fire_rate: 1000
            },
            2: {
                asteroids: 4,
                asteroid_speed: 2,
                ufos: 2,
                ufo_speed: 3,
                ufo_min_pause_time: 1000,
                ufo_max_pause_time: 3000,
                ufo_missile_fire_rate: 1000
            },
            3: {
                asteroids: 5,
                asteroid_speed: 2,
                ufos: 2,
                ufo_speed: 4,
                ufo_min_pause_time: 1000,
                ufo_max_pause_time: 3000,
                ufo_missile_fire_rate: 1000
            }
        }
    });
</script>
```

You can define the parameters and overall difficulty of each level you
create.


