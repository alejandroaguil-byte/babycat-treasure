// The story: every scene as [speaker, English, Spanish] rows, so both languages always keep the
// same lines and speakers. SCENES = { en: { key: [{ speaker, text }] }, es: { ... } }.
// Speakers are CHARACTERS keys. Keep lines short: they must fit a phone and read well aloud.

const SCRIPT = {
  // ------------------------------------------------------------ world 1: the Milk Tower
  w1_intro: [
    ['hazel', 'Up at the top of the world sits my Cozy Creamery, dears. And I keep four magic milk glasses there.',
      'Allá en la cima del mundo está mi Lechería Acogedora, queridos. Ahí guardo cuatro vasos de leche mágica.'],
    ['fluff', 'Milk! Clean, shiny, wholesome milk! Achoo! I can’t stand it!',
      '¡Leche! ¡Leche limpia, brillante y sana! ¡Achís! ¡No la soporto!'],
    ['fluff', 'Dust storm, blow! Scatter those glasses across the floating islands! Mwahaha... achoo!',
      '¡Tormenta de polvo, sopla! ¡Esparce esos vasos por las islas flotantes! ¡Muajaja... achís!'],
    ['mochi', 'Mew?!', '¿¡Miau?!'],
    ['pip', 'Phew, what a landing! Hi! I’m Pip! You’re Mochi, right? Grandma Hazel sent me!',
      '¡Uf, qué aterrizaje! ¡Hola! ¡Soy Pip! Tú eres Mochi, ¿verdad? ¡La abuela Hazel me envió!'],
    ['pip', 'One of the glasses fell right on top of the Milk Tower! We have to get it back!',
      '¡Uno de los vasos cayó justo arriba de la Torre de Leche! ¡Tenemos que recuperarlo!'],
    ['mochi', 'Mew! Milk! Let’s go!', '¡Miau! ¡Leche! ¡Vamos!'],
    ['pip', 'Tap a tile to walk there. Drag to look around the island. Easy peasy!',
      'Toca una casilla para caminar hasta ella. Arrastra para mirar la isla. ¡Facilísimo!'],
    ['pip', 'And if you get lost, tap my button. I’ll fly to the nearest gem! I can do it three times.',
      'Y si te pierdes, toca mi botón. ¡Volaré hasta la gema más cercana! Puedo hacerlo tres veces.'],
  ],
  w1_enemy: [
    ['pip', 'Eek! A dust bunny! One of Lord Fluff’s grumpy helpers!',
      '¡Ay! ¡Un conejito de polvo! ¡Uno de los gruñones ayudantes de Lord Fluff!'],
    ['mochi', 'Hsss!', '¡Fff!'],
    ['pip', 'Pick a yarn ball from a sprout and throw it. Dust bunnies can’t stand yarn!',
      'Arranca un ovillo de lana de un brote y lánzalo. ¡Los conejitos de polvo no soportan la lana!'],
  ],
  w1_switch: [
    ['mochi', 'Mew! Click!', '¡Miau! ¡Clic!'],
    ['pip', 'Look! A bridge appeared! That button was a secret switch!',
      '¡Mira! ¡Apareció un puente! ¡Ese botón era un interruptor secreto!'],
  ],
  w1_outro: [
    ['hazel', 'Ring ring! It’s Grandma Hazel on the milk-phone. You found the first glass! Thank you, little ones.',
      '¡Ring ring! Habla la abuela Hazel por el lechefono. ¡Encontraron el primer vaso! Gracias, pequeños.'],
    ['mochi', 'Purr... milk mustache!', 'Purr... ¡bigote de leche!'],
    ['fluff', 'Bah! Beginner’s luck! The other three glasses are far, far away. Achoo!',
      '¡Bah! ¡Suerte de principiante! Los otros tres vasos están muy, muy lejos. ¡Achís!'],
    ['pip', 'Don’t listen to him! Next stop: the Windy Cliffs! Hold on to your whiskers!',
      '¡No le hagas caso! Próxima parada: ¡los Acantilados del Viento! ¡Sujeta bien tus bigotes!'],
  ],

  // ------------------------------------------------------------ world 2: Windy Autumn Cliffs
  w2_intro: [
    ['pip', 'Whoa, whoa, whoa! This wind keeps blowing me backwards!',
      '¡Uy, uy, uy! ¡Este viento me empuja hacia atrás!'],
    ['mochi', 'Mew! Hold on, Pip!', '¡Miau! ¡Agárrate, Pip!'],
    ['bruno', 'Heeelp... is anybody theeere... no rush...', 'Ayuuuda... ¿hay alguien ahííí...? Sin prisa...'],
    ['pip', 'Did you hear that? Someone is calling for help! Let’s find them!',
      '¿Oíste eso? ¡Alguien pide ayuda! ¡Vamos a buscarlo!'],
  ],
  w2_gust_first: [
    ['pip', 'The wind is rising! When the arrow turns red, a gust will push you!',
      '¡Sube el viento! ¡Cuando la flecha se ponga roja, una ráfaga te va a empujar!'],
    ['pip', 'Hide behind rocks or a higher step. And stay away from the edges!',
      'Escóndete detrás de las rocas o de un escalón más alto. ¡Y aléjate de las orillas!'],
    ['mochi', 'Mew! Paws down!', '¡Miau! ¡Patitas firmes!'],
  ],
  w2_bruno_join: [
    ['bruno', 'Oh... hello there... I’m Bruno. I’ve been stuck here since... last Tuesday. Or the one before.',
      'Oh... hola... Soy Bruno. Estoy atascado aquí desde... el martes pasado. O el anterior.'],
    ['bruno', 'Every time I take a step, the wind flips me onto my shell. Most un-shell-ievable.',
      'Cada vez que doy un paso, el viento me voltea panza arriba. ¡No hay capa-razón que aguante!'],
    ['mochi', 'Mew... poor Bruno!', 'Miau... ¡pobre Bruno!'],
    ['bruno', 'Let’s walk together, little one. My shell is a wall the wind can’t move.',
      'Caminemos juntos, pequeña. Mi caparazón es una pared que el viento no puede mover.'],
    ['bruno', 'When a gust comes, stand right behind me. Slow and steady wins the day.',
      'Cuando venga una ráfaga, ponte justo detrás de mí. Despacio y con calma se llega lejos.'],
    ['pip', 'A walking wall! Bruno, you’re the best!', '¡Una pared que camina! ¡Bruno, eres lo máximo!'],
  ],
  w2_key: [
    ['mochi', 'Mew! A key!', '¡Miau! ¡Una llave!'],
    ['bruno', 'Ah... that opens the gate. I knew it all along... I just never got there.',
      'Ah... esa abre la reja. Siempre lo supe... solo que nunca llegué hasta allá.'],
    ['pip', 'To the gate! Then up to the milk!', '¡A la reja! ¡Y después arriba, a la leche!'],
  ],
  w2_outro: [
    ['bruno', 'Thank you, little friends. Now I can finally shuffle home... I should be there by spring.',
      'Gracias, amiguitos. Por fin puedo volver a casa... llegaré para la primavera.'],
    ['bruno', 'Next is the Night Garden. It’s dark, but you have each other. That’s turtle-y enough.',
      'Lo que sigue es el Jardín Nocturno. Está oscuro, pero se tienen el uno al otro. Eso basta y sobra.'],
    ['mochi', 'Mew! Bye, Bruno!', '¡Miau! ¡Adiós, Bruno!'],
    ['fluff', 'Two glasses?! Grrr! You will never get past my night garden! Achoo!',
      '¿¡Dos vasos?! ¡Grrr! ¡Nunca pasarán por mi jardín nocturno! ¡Achís!'],
  ],

  // ------------------------------------------------------------ world 3: Stormy Night Garden
  w3_intro: [
    ['pip', 'It’s sooo dark... and that thunder... I’m hiding in your fur, okay?',
      'Está taaan oscuro... y esos truenos... Me escondo en tu pelito, ¿sí?'],
    ['mochi', 'Mew... brave kitty. Brave!', 'Miau... gatita valiente. ¡Valiente!'],
    ['luna', 'Do not be afraid, little travelers. Even the darkest night is full of small lights.',
      'No tengan miedo, pequeños viajeros. Hasta la noche más oscura está llena de lucecitas.'],
  ],
  w3_luna_join: [
    ['luna', 'I am Luna, the glow moth. I keep the fireflies of this garden.',
      'Soy Luna, la polilla luminosa. Cuido a las luciérnagas de este jardín.'],
    ['luna', 'The storm scattered them like seeds in the wind. Bring five home, and they will light a bridge.',
      'La tormenta las esparció como semillas al viento. Trae cinco a casa y iluminarán un puente.'],
    ['luna', 'Beware the wisps. My light flash can freeze them. Tap my button when they come close.',
      'Cuidado con los fuegos fatuos. Mi destello de luz puede congelarlos. Toca mi botón cuando se acerquen.'],
    ['pip', 'A night light with wings! I’m not scared anymore! ...Mostly.',
      '¡Una lamparita con alas! ¡Ya no tengo miedo! ...Casi.'],
    ['mochi', 'Mew! Shiny friend!', '¡Miau! ¡Amiga brillante!'],
  ],
  w3_wisp_first: [
    ['pip', 'A wisp! It’s floating right at us!', '¡Un fuego fatuo! ¡Viene flotando hacia nosotros!'],
    ['luna', 'Now! My light! Tap my button and I will shine like the moon!',
      '¡Ahora! ¡Mi luz! ¡Toca mi botón y brillaré como la luna!'],
  ],
  w3_fireflies: [
    ['luna', 'All five are home. Look... they are weaving a bridge of light.',
      'Las cinco están en casa. Miren... están tejiendo un puente de luz.'],
    ['mochi', 'Mew! So pretty!', '¡Miau! ¡Qué bonito!'],
    ['pip', 'A glowing bridge! Best. Night. Ever!', '¡Un puente que brilla! ¡La. Mejor. Noche!'],
  ],
  w3_outro: [
    ['luna', 'Thank you, Mochi. The garden will dream sweetly tonight.',
      'Gracias, Mochi. El jardín soñará bonito esta noche.'],
    ['hazel', 'Ring ring! Three glasses, my darlings! Only the snowy peak is left. Bundle up!',
      '¡Ring ring! ¡Tres vasos, mis amores! Solo falta la cumbre nevada. ¡Abríguense bien!'],
    ['fluff', 'The peak is MY home! It’s cold, it’s dusty and it’s... achoo! ...perfect!',
      '¡La cumbre es MI casa! Es fría, polvorienta y... ¡achís! ...¡perfecta!'],
  ],

  // ------------------------------------------------------------ world 4: Snowy Peak
  w4_intro: [
    ['pip', 'Brrr! My feathers are turning into icicles!', '¡Brrr! ¡Mis plumas se están volviendo carámbanos!'],
    ['mochi', 'Mew... cold paws...', 'Miau... patitas frías...'],
    ['pip', 'Look! A little penguin, all alone and shivering!', '¡Mira! ¡Un pingüinito, solito y temblando!'],
    ['pom', 'H-h-hi... I-I’m Pom...', 'H-h-hola... S-soy Pom...'],
  ],
  w4_pom_join: [
    ['pom', 'The b-blizzard blew my igloo away... C-can I come with you?',
      'La v-ventisca se llevó mi iglú... ¿P-puedo ir con ustedes?'],
    ['mochi', 'Mew! Yes! Friends!', '¡Miau! ¡Sí! ¡Amigos!'],
    ['pom', 'Th-thank you! If you stand still next to me... I give the warmest penguin hugs.',
      '¡G-gracias! Si te quedas quieta junto a mí... doy los abrazos de pingüino más calentitos.'],
    ['pom', 'Campfires and hot cocoa help too. B-but hugs are the best.',
      'Las fogatas y el chocolate caliente también ayudan. P-pero los abrazos son lo mejor.'],
    ['pip', 'Group hug! ...Oops, I squished my beak.', '¡Abrazo grupal! ...Ups, se me aplastó el pico.'],
  ],
  w4_blizzard_first: [
    ['pom', 'Oh no... a b-blizzard is coming! I can feel it in my flippers!',
      '¡Oh, no... viene una v-ventisca! ¡La siento en mis aletas!'],
    ['pip', 'When it hits, hide behind something tall and stay close to the fire!',
      '¡Cuando llegue, escóndete detrás de algo alto y quédate cerca del fuego!'],
    ['mochi', 'Mew! Huddle up!', '¡Miau! ¡Todos juntitos!'],
  ],
  w4_outro: [
    ['fluff', 'Achoo! Achoo! ACHOO! Stop... stop being so cute and clean...',
      '¡Achís! ¡Achís! ¡ACHÍS! Basta... basta de ser tan tiernos y limpios...'],
    ['pip', 'Lord Fluff! It’s over! You’re all out of dust!', '¡Lord Fluff! ¡Se acabó! ¡Ya no te queda polvo!'],
    ['fluff', 'Sniff... fine. The truth is... I only wanted some milk too. Nobody ever invites a dust bunny.',
      'Snif... está bien. La verdad es que... yo también quería leche. Nadie invita nunca a un conejito de polvo.'],
    ['mochi', 'Mew... share! Milk for everyone!', 'Miau... ¡compartir! ¡Leche para todos!'],
    ['pom', 'Even a dusty king needs a hug sometimes.', 'Hasta un rey polvoriento necesita un abrazo a veces.'],
    ['hazel', 'Well said, little ones. Everyone is welcome at the Cozy Creamery. Even dusty kings!',
      'Bien dicho, pequeños. Todos son bienvenidos en la Lechería Acogedora. ¡Hasta los reyes polvorientos!'],
    ['fluff', 'Really? Sniff... I’ll wipe my paws. Achoo! Sorry. Happy achoo.',
      '¿De verdad? Snif... me limpiaré las patas. ¡Achís! Perdón. Es un achís feliz.'],
    ['hazel', 'Four glasses home, and a table full of friends. Thank you for playing, dear!',
      'Cuatro vasos en casa y una mesa llena de amigos. ¡Gracias por jugar, cariño!'],
  ],
};

const build = (col) =>
  Object.fromEntries(Object.entries(SCRIPT).map(([key, rows]) => [key, rows.map((row) => ({ speaker: row[0], text: row[col] }))]));

export const SCENES = { en: build(1), es: build(2) };
