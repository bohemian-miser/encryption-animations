# Encryption Animations

An interactive, visual demonstration of cryptographic algorithms in the browser.

[**Try the Live Demos on GitHub Pages!**](https://bohemian-miser.github.io/encryption-animations/)

## Feistel Round Animation
This project features a wobbly, hand-drawn style step-by-step interactive simulator of a single round in a Feistel cipher.

### Features
- Step-by-step sequential animation of round operations:
  1. Right block value ($R_0$) flows to the round function $F$.
  2. Round subkey ($K_0$, derived from main key) flows to $F$.
  3. $F$ evaluates ($R_0 \oplus K_0$) and output flows to the XOR gate.
  4. Left block value ($L_0$) flows to the XOR gate.
  5. Crossover happens ($L_1 = R_0$), making the bottom-left register appear when the crossover arrow arrives.
  6. XOR output flows to $R_1$, making the bottom-right register appear when the XOR arrow arrives.
- **Fading Toggle**: Choose to fade registers out to show only current state, or keep all registers visible to view the entire circuit at once.
- **Hex XOR Calculator**: Interactive sidebar utility for manual XOR math.
- Symmetric (AES) and Asymmetric (RSA) animations are also available in the menu links.

## Credits & Reference
This simulator is inspired by and reverse-engineered from this excellent visual guide:
- **Animated Padding Oracle Attack**: [Watch on YouTube](https://www.youtube.com/watch?v=8Tr2aj6JETg)

## License
MIT
