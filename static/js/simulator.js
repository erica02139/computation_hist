'use strict';

// const PZE = "HTR"; // hack for pseudoinstruction PZE, which lets you store in an address, tag, and
// decrement without an operation

// if number is negative, put a 4 in the beginning: e.g. -0o345 will become 0o4345
const no_to_operation_b = {
    0o761: "NOP",
    0o601: "STO",
    0o000: "HTR",
    0o420: "HPR",
    0o500: "CLA",
    0o400: "ADD",
    0o402: "SUB",
    0o4400: "SBM",
    0o401: "ADM",
    0o534: "LXA",
    0o300: "FAD",
    0o302: "FSB",
    0o560: "LDQ",
    0o4600: "STQ",
    0o200: "MPY",
    0o260: "FMP",
    0o220: "DVH",
    0o221: "DVP",
    0o240: "FDH",
    0o241: "FDP",
    0o020: "TRA",
    0o100: "TZE",
    0o4100: "TNZ",
};

const no_to_operation_a = {
    0b110: "TNX",
    0b010: "TIX",
    0b000: "PZE", // hack for pseudoinstruction PZE
};
export const operation_b_to_no = {};
export const operation_a_to_no = {};
for (let number in no_to_operation_b) {
    if (no_to_operation_b.hasOwnProperty(number)) {
        operation_b_to_no[(no_to_operation_b[number])] = number;
    }
}
for (let number in no_to_operation_a) {
    if (no_to_operation_a.hasOwnProperty(number)) {
        operation_a_to_no[(no_to_operation_a[number])] = number;
    }
}
operation_a_to_no["PZE"] = 0b000; // hack for pseudoinstruction PZE
const non_indexable = {"TIX": 0, "TNX": 0, "TXH": 0, "TXL": 0, "TXI": 0, "TSX": 0, "LXA": 0, "LXD": 0, "SXD": 0, "PXD": 0, "PAX": 0, "PDX":0};

// Exceptions
const UNDEFINED_OPERATION_EXCEPTION = "Undefined operation!";
const INVALID_BINARY_NUMBER_EXCEPTION = "String contains characters aside from 1 and 0!";
const INVALID_UPDATE_CONTENTS_TYPE = "Contents must be of type number or string!";
const INVALID_REGISTER_EXCEPTION = "Tried to program to invalid register!";
const FIXED_OVERFLOW_EXCEPTION = "Fixed point number too large!";
const FLOAT_OVERFLOW_EXCEPTION = "Floating point number too large!";
const NAN_EXCEPTION = "Expected number, but it was me, Dio!";
const INVALID_INSTRUCTION_EXCEPTION = "Cannot parse instruction!";
const INVALID_INSTRUCTION_RUNTIME = "Cannot run instruction!";

const regex_line_parser = new RegExp('^([A-Z]+)\\s*(.*)');

/**
 * Function to create a new string with the character at index replaced by a new character.
 *
 * @param   {string} original_string     The original string.
 * @param   {number} index               The index at which to start replacing characters.
 * @param   {string} replacement         The character that should replace those in the original
 * string.
 * @returns {string}                     A new string with the characters replaced.
 */
function replaceAt(original_string, index, replacement) {
    return original_string.substr(0, index) + replacement+ original_string.substr(index + replacement.length);
}

/**
 * Returns a string binary representation of a number with leading zeros to achieve a certain
 * number of digits.
 *
 * @param {number} number   The number to be converted.
 * @param {number} digits   Number of digits that resulting binary representation should have.
 * @returns {string}    Binary representation with specified number of digits.
 */
function convert_to_binary(number, digits) {
    let result = number.toString(2);
    const length = result.length;
    for (let i = 0; i < digits - length; i++) {
        result = "0" + result;
    }
    return result.toString();
}

/**
 * A class representing a fixed-width word in the IBM 704.
 */
export class Word {
    /**
     * Constructor that sets the length and contents of the word.
     *
     * @param {string/number/Word}   contents    The contents of the word.
     * @param {number}               length      The length of the word in bits.
     */
    constructor(contents, length) {
        this.length = length;
        this.update_contents(contents);
    }

    /**
     * Adds zeroes to the beginning of a string until it reaches the length of this word's instance.
     *
     * @param   {string}  binary_rep   String of 1's and 0's.
     * @param   {number}  length       Desired length of string.
     * @returns {string}               String binary_rep with leading zeroes to be of desired
     * length.
     */
    static pad_zeroes(binary_rep, length) {
        let original_length = binary_rep.length;
        for (let i = 0; i < length - original_length; i++) {
            binary_rep = "0" + binary_rep;
        }
        return binary_rep;
    }

    /**
     * Function that sets the contents of the word. If binary representation is larger than can
     * be held in the word, bits will be truncated starting from the left.
     *
     * @param {string/number/Word} contents    The contents that the word should be set to.
     */
    update_contents(contents) {
        if (typeof contents === "object") {
            contents = contents.contents;
        }
        if (typeof contents === "number") {
            contents = convert_to_binary(contents, this.length);
        }
        if (typeof contents === "string") {
            if (isNaN(parseInt(contents, 2))) {
                throw INVALID_BINARY_NUMBER_EXCEPTION;
            } else if (contents.length > this.length) {
                console.log("Word has more than " + this.length + " bits.  Value will be" +
                    " truncated.");
                this.contents = contents.slice(contents.length - this.length);
            } else {
                this.contents = Word.pad_zeroes(contents, this.length);
            }
        } else {
            throw INVALID_UPDATE_CONTENTS_TYPE;
        }
    }

    /**
     * Clears contents, replacing all bits with 0.
     */
    clear() {
        this.update_contents(0);
    }

    /**
     * Performs binary addition between two words. The resulting string has the length of the
     * longer word.  Note that overflowing bits will simply be discarded. This function is also
     * unsuitable for simply adding fixed-point or floating-point numbers, as their literal
     * binary values are not the same as their actual values.
     *
     * @param   {Word/string}  word1       First addend.
     * @param   {Word/string}  word2       Second addend.
     * @returns {string}                   Sum.
     */
    static binary_add(word1, word2) {
        if (typeof word1 === "object") {
            word1 = word1.contents;
        }
        if (typeof word2 === "object") {
            word2 = word2.contents;
        }
        let sum = "";

        let carry_1 = false;
        for (let i = 0; i < Math.min(word1.length, word2.length); i++) {
            let index_1 = word1.length - 1 - i;
            let index_2 = word2.length - 1 - i;
            if (word1[index_1] === word2[index_2]) {
                if (carry_1) {
                    sum = "1" + sum;
                } else {
                    sum = "0" + sum;
                }
                carry_1 = word1[index_1] === "1";
            } else {
                if (carry_1) {
                    sum = "0" + sum;
                    carry_1 = true;
                } else {
                    sum = "1" + sum;
                    carry_1 = false;
                }
            }
        }

        if (word1.length < word2.length) {
            sum = word2.slice(word1.length) + sum;
        } else {
            sum = word1.slice(word2.length) + sum;
        }
        return sum;
    }

    /**
     * Performs a bitwise AND operation between two words. The resulting string has the length
     * of the longer word.
     *
     * @param   {Word/string}  word1       First word.
     * @param   {Word/string}  word2       Second word.
     * @returns {string}                   Result of bitwise AND.
     */
    static binary_and(word1, word2) {
        if (typeof word1 === "object") {
            word1 = word1.contents;
        }
        if (typeof word2 === "object") {
            word2 = word2.contents;
        }
        let result = "";
        for (let i = 0; i < Math.min(word1.length, word2.length); i++) {
            let index_1 = word1.length - 1 - i;
            let index_2 = word2.length - 1 - i;
            if (word1[index_1] === "1" && word2[index_2] === "1") {
                result = "1" + result;
            } else {
                result = "0" + result;
            }
        }
        return Word.pad_zeroes(result, Math.max(word1.length, word2.length));
    }

    /**
     * Performs a bitwise OR operation between two words. The resulting string has the length
     * of the longer word.
     *
     * @param   {Word/string}  word1       First word.
     * @param   {Word/string}  word2       Second word.
     * @returns {string}                   Result of bitwise OR.
     */
    static binary_or(word1, word2) {
        if (typeof word1 === "object") {
            word1 = word1.contents;
        }
        if (typeof word2 === "object") {
            word2 = word2.contents;
        }
        let result = "";
        for (let i = 0; i < Math.min(word1.length, word2.length); i++) {
            let index_1 = word1.length - 1 - i;
            let index_2 = word2.length - 1 - i;
            if (word1[index_1] === "0" && word2[index_2] === "0") {
                result = "0" + result;
            } else {
                result = "1" + result;
            }
        }
        if (word1.length < word2.length) {
            result = word2.slice(word1.length) + result;
        } else {
            result = word1.slice(word2.length) + result;
        }
        return result;
    }

    /**
     * Returns string representation of word.
     *
     * @returns {string}   String representing contents of word.
     */
    toString() {
        return this.contents.slice(0);
    }

    /**
     * Returns numerical value corresponding to the contents of the word interpreted as a
     * literal binary number.
     *
     * @returns {number}   Literal numerical value of contents of word.
     */
    valueOf() {
        return parseInt(this.contents, 2);
    }
}

/**
 * Class to represent an instruction.  This is basically a struct.
 */
class Instruction {
    /**
     * Constructor to produce an instruction with given operation, address, and tag.
     *
     * @param {string}        operation
     * @param {number}          address
     * @param {number/string}   tag
     */
    constructor(operation, address, tag = 0) {
        this.operation = operation;
        this.address = address;
        if (typeof tag === "string") {
            switch(tag) {
                case "A":
                    this.tag = 0b001;
                    break;
                case "B":
                    this.tag = 0b010;
                    break;
                case "C":
                    this.tag = 0b100;
                    break;
            }
        } else {
            this.tag = tag;
        }
    }

    /**
     * Returns whether this instruction's operations is one of the indexable operations.
     *
     * @returns {boolean}   Whether operation is indexable.
     */
    indexable() {
        return !(this.operation in non_indexable);
    }

}

/**
 * A class representing a Type B instruction.
 */
class Instruction_B extends Instruction {
    /**
     * Returns a string representation of the instruction, in form OPERATION address, tag.  Note
     * that displayed numbers are in decimal.
     *
     * @returns {string}    String representation of instruction.
     */
    toString() {
        let address_str = this.address.toString();
        if (this.operation) {
            if (this.tag) {
                let tag_str = this.tag.toString();
                return this.operation + " " + address_str + ", " + tag_str;
            } else {
                return this.operation + " " + address_str;
            }
        } else {
            return "Undefined operation!";
        }
    }
}

/**
 * A class representing a Type A instruction.
 */
class Instruction_A extends Instruction {
    /**
     * Constructor to produce an instruction with given operation, address, and tag.
     *
     * @param {string}        operation
     * @param {number}          address
     * @param {number/string}   tag
     * @param {number}          decrement
     */
    constructor(operation, address, tag, decrement) {
        super(operation, address, tag);
        this.decrement = decrement;
    }

    /**
     * Returns a string representation of the instruction, in form OPERATION address, tag,
     * decrement. Note that displayed numbers are in decimal.
     *
     * @returns {string}    String representation of instruction.
     */
    toString() {
        if (this.operation) {
            let address_str = this.address.toString();
            let tag_str = this.tag.toString();
            let decrement_str = this.decrement.toString();
            return this.operation + " " + address_str + ", " + tag_str + ", " + decrement_str;
        } else {
            return "Undefined operation!";
        }
    }
}

/**
 * A class representing a word in general memory in the IBM 704, all of which were 36 bits. Note
 * that the computer has no way of determining whether a word is an instruction or a number, and
 * making sure that the word is interpreted correctly is the job of the programmer. However, the
 * computer can determine if an instruction is Type A or B by looking at the first three bits.
 */
class General_Word extends Word {

    /**
     * Constructor that sets the length and contents of the word.
     *
     * @param {string/number}   contents    The contents of the word.
     */
    constructor(contents) {
        super(contents, 36);
    }

    is_typeB() {
        return this.contents[1] === "0" && this.contents[2] === "0";
    }

    /**
     * Returns the address that this word's instruction is directed at.
     *
     * @returns {number}    Address that instruction is directed at.
     */
    get address() {
        let str_address = this.contents.substr(-15);
        return parseInt(str_address, 2);
    }

    /**
     * Returns the operation of a Type B instruction.
     *
     * @returns {function}  Function corresponding to the operation contained in instruction.
     */
    get operation_b() {
        let str_operation = this.contents.substring(0, 12);
        let operation_number = parseInt(str_operation, 2);
        return no_to_operation_b[operation_number];
    }

    /**
     * Returns the operation of a Type A instruction.
     *
     * @returns {function}  Function corresponding to the operation contained in instruction.
     */
    get operation_a() {
        let prefix_bits = this.contents.substring(0,3);
        return no_to_operation_a[parseInt(prefix_bits, 2)];
    }

    /**
     * Returns the operation of an instruction.
     *
     * @returns {function}  Function corresponding to the operation contained in instruction.
     */
    get operation() {
        if (this.is_typeB()) {
            return this.operation_b();
        } else {
            return this.operation_a();
        }
    }

    /**
     * Gets the tag from the word's instruction.  Note that the tag is located in the same bits
     * in both type A and type B instructions.
     *
     * @returns {number}    Tag of the instruction if word is interpreted as instruction.
     */
    get tag() {
        let tag = this.contents.substring(18, 21);
        return parseInt(tag, 2);
    }

    /**
     * Gets the decrement from the word as interpreted as Type B instruction.
     *
     * @returns {number}
     */
    get decrement() {
        let decrement = this.contents.substring(3, 18);
        return parseInt(decrement, 2);
    }

    /**
     * Store Type B instruction into the word.
     *
     * @param {Instruction_B}   instruction     Instruction to be stored in word.
     */
    set instruction_b(instruction) {
        this.update_contents(Math.pow(2, 24) * operation_b_to_no[instruction.operation] + Math.pow(2, 15)*instruction.tag + instruction.address);
    }

    /**
     * Return Instruction_B object based on interpretation of word as Type B operation.
     *
     * @returns {Instruction_B}     Word as Type B instruction.
     */
    get instruction_b() {
        return new Instruction_B(this.operation_b, this.address, this.tag);
    }

    /**
     * Stores a Type B instruction into the word.
     *
     * @param {string} operation    String name of operation.
     * @param {number} address      Address that instruction is directed at.
     * @param {number} tag          Tag of instruction (optional).
     */
    store_instruction_b(operation, address, tag = 0) {
        this.instruction_b = new Instruction_B(this[operation], address, tag);
    }

    /**
     * Return Instruction_A object based on interpretation of word as Type A operation.
     *
     * @returns {Instruction_A}     Word as Type A instruction.
     */
    get instruction_a() {
        return new Instruction_A(this.operation_a, this.address, this.tag, this.decrement);
    }

    /**
     * Store Type A instruction into the word.
     *
     * @param {Instruction_A}   instruction     Instruction to be stored in word.
     */
    set instruction_a(instruction) {
        this.update_contents(Math.pow(2, 33) * operation_a_to_no[instruction.operation] + Math.pow(2, 18)*instruction.decrement +
            Math.pow(2, 15)*instruction.tag + instruction.address);
    }

    /**
     * Stores a Type A instruction into the word.
     *
     * @param {string} operation    String name of operation.
     * @param {number} address      Address that instruction is directed at.
     * @param {number} tag          Tag of instruction.
     * @param {number} decrement    Decrement of instruction.
     */
    store_instruction_a(operation, address, tag, decrement) {
        this.instruction_a = new Instruction_A(this[operation], address, tag, decrement);
    }

    /**
     * Get Instruction object corresponding to word.
     *
     * @returns {Instruction}   Instruction stored in word.
     */
    get instruction() {
        if (this.is_typeB()) {
            return this.instruction_b;
        } else {
            return this.instruction_a;
        }
    }

    /**
     * Store instruction in word.
     *
     * @param {Instruction} instruction
     */
    set instruction(instruction) {
        if (typeof instruction.decrement === "undefined") {
            this.instruction_b = instruction;
        } else {
            this.instruction_a = instruction;
        }
    }

    /**
     * Returns numerical value of word interpreted as fixed point number. Note that the IBM 704
     * doesn't actually keep track of where the decimal (binary?) point is in memory, leaving
     * the interpretation of the number to the programmer.  This function assumes the dot to be
     * at the very left of the number. For more information on how the IBM 704 stores numbers,
     * check the Markdown in the History Group folder.
     *
     * @returns {number}    Numerical value of word interpreted as a fixed-point number.
     */
    get fixed_point() { // getter and setter is sort of like a union in C
        let binary_rep = this.contents;
        let positive;
        if (binary_rep.length === 36) {
            positive = binary_rep[0] === "0";
            binary_rep = binary_rep.substring(1);
        } else {
            positive = true;
        }
        let result = parseInt(binary_rep, 2);
        if (!positive) {
            result = -result;
        }
        return result;
    }

    /**
     * Converts a string binary representation of an IBM 704 word to a string decimal representation
     * of that word interpreted as a floating point number.  For more information on how the IBM 704
     * stores numbers, check the Markdown in the History Group folder.
     *
     * @returns {number}    Numerical value representation of word interpreted as floating-point
     * number.
     */
    get floating_point() {
        let binary_rep = this.contents;
        let fraction_bits = binary_rep.substring(9,36);
        let fraction = parseInt(fraction_bits, 2) / Math.pow(2, 27);
        let characteristic_bits = binary_rep.substring(1, 9);
        let characteristic = parseInt(characteristic_bits, 2);
        let exponent = characteristic - 128;
        let result = fraction*Math.pow(2,exponent);
        if (binary_rep[0] === "1") {
            result = -result;
        }
        return result;
    }

    /**
     * Stores a fixed point number into the word.  Be sure to distinguish positive and negative zero.
     *
     * @param {number} number       Number to be stored.
     */
    set fixed_point(number) {
        let sign_bit;
        if (number < 0 || Object.is(number, -0)) {
            sign_bit = "1";
        } else {
            sign_bit = "0";
        }
        let unsigned_binary_rep = convert_to_binary(Math.abs(number), 36);
        let binary_rep = replaceAt(unsigned_binary_rep, unsigned_binary_rep.length - 36, sign_bit);
        this.update_contents(binary_rep);
    }

    /**
     * Stores a number in floating-point format into the word.  The number will always be normalized,
     * which means that the fraction will be between 1/2 and 1.
     *
     * @param {number}  number      Number to be stored.
     */
    set floating_point(number) {
        if (number === 0) {
            this.fixed_point = number;
            return;
        }
        let exponent = Math.floor(Math.log2(Math.abs(number))) + 1;
        let characteristic = exponent + 128;
        this.store_floating_point(number, Math.max(characteristic,0));
    }

    /**
     * Stores a number in floating-point format into the word with a specific characteristic.  Generally,
     * using the floating_point function is preferred because the word will be normalized.
     *
     * @param {number} number           Number to be stored.
     * @param {number} characteristic   Characteristic of floating point number when stored.  (Check MD
     * for more info.)
     */
    store_floating_point(number, characteristic) {
        let sign_bit;
        if (number < 0) {
            sign_bit = "1";
        } else {
            sign_bit = "0";
        }
        let binary_rep = sign_bit;
        number = Math.abs(number);
        let exponent = characteristic - 128;
        binary_rep += convert_to_binary(characteristic, 8);
        let magnitude = number / Math.pow(2, exponent);
        let magnitude_binary = (magnitude.toString(2)).substring(2,29);
        const length = magnitude_binary.length;
        for (let i = 0; i < 27 - length; i++) {
            magnitude_binary = magnitude_binary + "0";
        }
        binary_rep += magnitude_binary;
        this.update_contents(binary_rep);
    }
}

let max_word = new General_Word("011111111111111111111111111111111111");
const MAX_FIXED_POINT = max_word.fixed_point;
const MAX_FLOATING_POINT = max_word.floating_point;

/**
 * Class representing the accumulator on the IBM 704.  The accumulator consists of 38 bits: a
 * sign, two overflow bits called Q and P, and the 36 bits that hold the actual numerical value.
 * The property of the accumulator that is important is that it does arithmetic; to add two
 * numbers together, one must first store one number to the accumulator, and then add the other,
 * upon which the accumulator will contain their sum.  You cannot simply add two words together.
 * The accumulator is also used in floating point operations, but this is more complicated.
 */
class Accumulator extends Word {
    /**
     * Constructor for Accumulator object.
     */
    constructor() {
        super(0, 38);
    }

    /**
     * Get value of number stored in accumulator, interpreted as fixed point.  When storing from the
     * accumulator to a word in the general memory, the Q and P bits should not be included.
     *
     * @returns {number}    Value of fixed-point accumulator.
     */
    get fixed_point() {
        let positive = this.contents[Accumulator.Sign] === "0";
        let result = parseInt(this.contents.slice(1), 2);
        if (!positive) {
            result = -result;
        }
        return result;
    }

    /**
     * Set value of accumulator to some number.  Note that while the P and Q bits will be
     * updated to indicate overflow, they won't be copied back into the general memory if you
     * use STO.
     *
     * @param {number}  number  Value to be stored in accumulator.
     */
    set fixed_point(number) {
        let sign_bit;
        if (number < 0 || Object.is(number, -0)) {
            sign_bit = "1";
        } else {
            sign_bit = "0";
        }
        let unsigned_binary_rep = convert_to_binary(Math.abs(number), 37);
        unsigned_binary_rep = unsigned_binary_rep.slice(Math.max(unsigned_binary_rep.length - 37, 0));
        let binary_rep = sign_bit + unsigned_binary_rep;
        this.update_contents(binary_rep);
    }

    /**
     * Converts a string binary representation of the accumulator to its value interpreted as a
     * floating point number.  For more information on how the IBM 704 stores numbers, check the Markdown in the
     * History Group folder.
     *
     * @returns {number}    Numerical value representation of word interpreted as floating-point
     * number.
     */
    get floating_point() {
        let binary_rep = this.contents;
        let fraction_bits = binary_rep.substring(11,38);
        let fraction = parseInt(fraction_bits, 2) / Math.pow(2, 27);
        let characteristic_bits = binary_rep.substring(1, 11);
        let characteristic = parseInt(characteristic_bits, 2);
        let exponent = characteristic - 128;
        let result = fraction*Math.pow(2,exponent);
        if (binary_rep[0] === "1") {
            result = -result;
        }
        return result;
    }

    /**
     * Stores a number in floating-point format into the word.  The number will always be normalized,
     * which means that the fraction will be between 1/2 and 1.
     *
     * @param {number}  number      Number to be stored.
     */
    set floating_point(number) {
        if (number === 0) {
            this.fixed_point = number;
            return;
        }
        let exponent = Math.floor(Math.log2(Math.abs(number))) + 1;
        let characteristic = exponent + 128;
        this.store_floating_point(number, Math.max(characteristic,0));
    }

    /**
     * Stores a number in floating-point format into the accumulator with a specific characteristic.  Generally,
     * using the floating_point function is preferred because the word will be normalized.
     *
     * @param {number} number           Number to be stored.
     * @param {number} characteristic   Characteristic of floating point number when stored.  (Check MD
     * for more info.)
     */
    store_floating_point(number, characteristic) {
        let sign_bit;
        if (number < 0) {
            sign_bit = "1";
        } else {
            sign_bit = "0";
        }
        let binary_rep = sign_bit;
        number = Math.abs(number);
        let exponent = characteristic - 128;
        binary_rep += convert_to_binary(characteristic, 10);
        let magnitude = number / Math.pow(2, exponent);
        let magnitude_binary = (magnitude.toString(2)).substring(2,29);
        const length = magnitude_binary.length;
        for (let i = 0; i < 27 - length; i++) {
            magnitude_binary = magnitude_binary + "0";
        }
        binary_rep += magnitude_binary;
        this.update_contents(binary_rep);
    }

    /**
     * Returns true if the Q bit is 1.
     *
     * @returns {boolean}   Q bit.
     */
    get q() {
        return this.contents[Accumulator.Q] === "1";
    }

    /**
     * Returns true if the P bit is 1.
     *
     * @returns {boolean}   P bit.
     */
    get p() {
        return this.contents[Accumulator.P] === "1";
    }

    /**
     * Properly stores a general word into the accumulator, with correct sign and bits 1-35 but
     * ignoring the P and Q bits.
     *
     * @param {General_Word} word   Word to be stored.
     */
    store_general_word(word) {
        let new_contents = word.contents[0];
        new_contents += this.contents[1] + this.contents[2];
        new_contents += word.contents.substring(1);
        this.update_contents(new_contents);
    }
}
Accumulator.Sign = 0;
Accumulator.Q = 1;
Accumulator.P = 2;

/**
 * Class that represents the Multipler-Quotient register.  The MQ register is used for
 * multiplying and division, and also for floating point operations.  More on this later when I
 * figure out how it actually works.
 */
class MQ_Register extends General_Word { // currently just a dummy class
    /**
     * Constructor for MQ Register.
     */
    constructor() {
        super(0);
    }
}

/**
 * Class that represents the storage register.  If for example ADD 134 is called, the word at
 * 134 is copied into the storage register before being added to the accumulator.  The
 * programmer usually doesn't have to worry about it because its function is abstracted away.
 */
class Storage_Register extends General_Word {
    /**
     * Constructor for storage register.
     */
    constructor() {
        super(0);
    }
}

/**
 * Class that represents the instruction register.  Before an instruction is executed, it is
 * copied into the instruction register, albeit in a bit convoluted manner.
 */
class Instruction_Register extends Word {
    /**
     * Constructor for instruction register class.
     */
    constructor() {
        super(0, 18);
        this.is_typeA = false;
    }

    /**
     * Stores Type B instruction into the instruction register in the way the IBM 704 does it.
     *
     *
     * @param {string/General_Word}  word     Instruction to be stored in instruction register.
     */
    store_instruction_b(word) {
        let instruction;
        if (typeof word === "object") {
            instruction = word.contents;
        } else {
            instruction = word;
        }
        let result = instruction[0];
        result += instruction.substring(3, 12);
        const length = result.length;
        for (let i = 0; i < 18 - length; i++) {
            result += "1";
        }
        this.update_contents(result);
        this.is_typeA = false;
    }

    /**
     * Stores Type A instruction into instruction register.
     *
     * @param {General_Word/string} word    Word holding instruction to be stored.
     */
    store_instruction_a(word) {
        let result = convert_to_binary(0, 18);
        if (typeof word === "object") {
            word = word.contents;
        }
        result = replaceAt(result, 0, word[0]);
        result = replaceAt(result, 8, word.substring(1,3));
        this.update_contents(result);
        this.is_typeA = true;
    }

    /**
     * Stores instruction into instruction register. Does not handle input-output, shifting, or sense instructions.
     *
     * @param {General_Word} word   Word to be stored into instruction register.
     */
    store_instruction(word) {
        if (word.is_typeB()) {
            this.store_instruction_b(word);
        } else {
            this.store_instruction_a(word);
        }
    }

    /**
     * Returns string with the name of the operation held in the instruction register.
     *
     * @returns {string}    String corresponding to name of operation in instruction register.
     */
    get_instruction_str() {
        if (this.is_typeA) {
            let opcode = this.contents[0] + this.contents[8] + this.contents[9];
            let operation = no_to_operation_a[parseInt(opcode, 2)];
            if (typeof operation === "undefined") {
                return "Unrecognized operation";
            } else {
                return operation;
            }
        } else {
            let opcode = parseInt(this.contents.substring(1, 10), 2);
            if (this.contents[0] === "1") {
                opcode += 0o4000;
            }
            let operation = no_to_operation_b[opcode];
            if (typeof operation === "undefined") {
                return "Unrecognized operation";
            } else {
                return operation;
            }
        }
    }
}

/**
 * Class that represents the instruction location register of the IBM 704.  Analogous to the
 * program counter in modern computers, it basically keeps track of the address of the
 * instructions being executed.  In all operations except Halt and Transfer, if the IBM 704
 * stops, the instruction location register should point to the address of the last instruction
 * executed+1.  Value is literal, so valueOf and updateContents can be used to get and set the
 * contents.
 */
class Instruction_Location_Register extends Word {
    /**
     * Constructor for instruction location register that starts at address origin.
     *
     * @param {number} origin   Starting location of instruction location register.
     */
    constructor(origin = 0) {
        super(origin, 13);
    }

    /**
     * Increases the instruction location register by value.  Note that the ILC can overflow and
     * go back to zero.
     *
     * @param {number} value    The amount that the instruction location register increases by.
     */
    skip(value) {
        this.update_contents(this.valueOf() + value);
    }

    /**
     * Increment the instruction location register by 1.
     */
    increment() {
        this.skip(1);
    }
}

/**
 * Class representing an index register.  Documentation forthcoming.
 */
class Index_Register extends Word {
    /**
     * Constructor that sets the length and contents of the index register.
     *
     * @param {string/number/Word}   contents    The contents of the index register.
     */
    constructor(contents) {
        super(contents, 13);
    }
}

/**
 * Class that represents an IBM 704.  The one at MIT I believe has 8192 words of general memory,
 * but this implementation lets you make it smaller if you don't need it.
 */
export class IBM_704 {
    /**
     * Constructor for IBM 704.
     *
     * @param {number} size     Number of words in general memory.
     */
    constructor(size = 8192) {
        this.size = size;
        this.clear();
    }

    /**
     * Step through a single instruction.
     */
    step() {
        if (this.halt) {
            return;
        }
        let instruction_word = this.general_memory[this.ilc.valueOf()];
        this.instruction_register.store_instruction(instruction_word);
        this.ilc.increment();
        let effective_address = instruction_word.address;
        let instruction = instruction_word.instruction;
        if (instruction.indexable()) {
            let tag_str = convert_to_binary(instruction.tag,3);
            if (tag_str[0] === "1") {
                effective_address -= this.index_c.valueOf();
            }
            if (tag_str[1] === "1") {
                effective_address -= this.index_b.valueOf();
            }
            if (tag_str[2] === "1") {
                effective_address -= this.index_a.valueOf();
            }
        }
        this.storage_register.update_contents(this.general_memory[effective_address]);
        if (instruction_word.is_typeB()) {
            instruction = instruction_word.instruction_b;
            if (typeof instruction.operation === "undefined") {
                alert("Halting on unrecognized operation!");
                this.halt = true;
                throw INVALID_INSTRUCTION_RUNTIME;
            }
            this[instruction.operation](effective_address, instruction.tag);
        } else {
            instruction = instruction_word.instruction_a;
            if (typeof instruction.operation === "undefined") {
                alert("Halting on unrecognized operation!");
                this.halt = true;
                throw INVALID_INSTRUCTION_RUNTIME;
            }
            this[instruction.operation](effective_address, instruction.tag, instruction.decrement);
        }
        if (this.accumulator.p) {
            this.ac_overflow = true;
        }
    }

    /**
     * Run the computer.
     */
    run() {
        this.halt = false;
        while (!this.halt) {
            this.step();
        }
    }
    /**
     * Resets the IBM 704 so all registers are 0.
     */
    clear() {
        this.general_memory = new Array(this.size);
        for (let i = 0; i < this.size; i++) {
            this.general_memory[i] = new General_Word(0);
        }
        this.accumulator = new Accumulator();
        this.mq_register = new MQ_Register();
        this.storage_register = new Storage_Register();
        this.instruction_register = new Instruction_Register();
        this.ilc = new Instruction_Location_Register();
        this.index_a = new Index_Register(0);
        this.index_b = new Index_Register(0);
        this.index_c = new Index_Register(0);

        // Indicator light
        this.ac_overflow = false; // goes on if a 1 passes into the P bit of the accumulator
        this.mq_overflow = false; // goes on if floating point operation is outside range 000-255
        this.divide_check = false;
        this.tape_check = false;
        this.trap_mode = false;
        this.sense_switches = new Array(6).fill(false);
        this.sense_lights = new Array(4).fill(false);

        this.halt = false;
    }

    /**
     * Converts an array of strings that contain lines of SHARE assembly into numerical code that is
     * placed in general memory.
     *
     * Currently missing most operations, including all Type A operations and pseudo-operations.
     *
     * @param {number} origin        Where to start storing the program.
     * @param {Array}  code_lines    Array of lines of code.
     */
    assemble(origin, code_lines) {
        this.clear();
        let register = origin;
        for (let line_no in code_lines) {
            if (!code_lines.hasOwnProperty(line_no)) {
                continue;
            }
            let line = code_lines[line_no];
            console.log(line);
            if (!line.replace(/\s/g, '').length) {
              continue;
            }
            if (isNaN(register) || register >= this.size || register < 0) {
                alert("Error: Tried to program to invalid register " + register + "on line " +
                    (parseInt(line_no) + 1) + "!  Register must be integer between 0 and " + (this.size - 1) + ".");
                throw INVALID_REGISTER_EXCEPTION;
            }
            let parsed_command = regex_line_parser.exec(line);
            if (parsed_command === null) { //if parsed command is null, throw error, not a valid command.
                alert("Error: Cannot parse instruction on line " + (parseInt(line_no) + 1) + ".");
                throw INVALID_INSTRUCTION_EXCEPTION;
            }
            let operation = parsed_command[1];
            let rest_of_line = parsed_command[2];
            let numbers = rest_of_line.split(",");
            try {
                if (operation === "ORG") { // ORG pseudoinstruction lets you program to different location
                    register = Number(numbers[0]);
                    if (isNaN(register)) {
                        throw NAN_EXCEPTION;
                    }
                    continue;
                } else if (operation === "DEC") { // DEC psuedoinstruction lets you program fixed and floating point numbers
                    let number = Number(numbers[0]);
                    if (isNaN(number)) {
                        throw NAN_EXCEPTION;
                    }
                    if (numbers[0].includes(".")) {
                        if (number > MAX_FLOATING_POINT || number < -MAX_FLOATING_POINT) {
                            alert("Error: Floating point value " + number + " at line " + (Number(line_no) + 1) +
                                " is too large! Floating point numbers must be between " + MAX_FLOATING_POINT +
                                " and " + -(MAX_FLOATING_POINT) + "."
                            );
                            throw FLOAT_OVERFLOW_EXCEPTION;
                        }
                        this.general_memory[register].floating_point = number;
                    } else {
                        if (number > MAX_FIXED_POINT || number < -MAX_FIXED_POINT) {
                            alert("Error: Fixed point value " + number + " at line " + (Number(line_no) + 1) +
                                " is too large! Fixed point numbers must be between " + MAX_FIXED_POINT +
                                " and " + -(MAX_FIXED_POINT) + "."
                            );
                            throw FIXED_OVERFLOW_EXCEPTION;
                        }
                        this.general_memory[register].fixed_point = number;
                    }
                } else {
                    if (numbers[2] !== undefined) {
                        let decrement = Number(numbers[2]);
                        let tag = Number(numbers[1]);
                        let address = Number(numbers[0]);
                        this.assemble_line(register, operation, address, tag, decrement);
                    } else if (numbers[1] !== undefined) {
                        let tag = Number(numbers[1]);
                        let address = Number(numbers[0]);
                        this.assemble_line(register, operation, address, tag);
                    } else if (numbers[0] !== "") {
                        let address = Number(numbers[0]);
                        this.assemble_line(register, operation, address);
                    } else {
                        this.assemble_line(register, operation);
                    }
                }
            }
            catch (err) {
                if (err === UNDEFINED_OPERATION_EXCEPTION) {
                    alert("Error: Undefined operation in line " + (parseInt(line_no) + 1) + "!");
                } else if (err === NAN_EXCEPTION) {
                    alert("Error: Invalid number in line " + (parseInt(line_no) + 1) + "!");
                }
                throw err;
            }
            register++;
        }
    }

    /**
     * Stores an instruction into general memory as a number.  Currently doesn't handle Type A
     * operations or tags.
     *
     * @param {number} register     Address that instruction should be stored in.
     * @param {string} operation    String name of operation.
     * @param {number} address      Address that instruction is directed at.
     * @param {number} tag          Tag of instruction.
     * @param {number} decrement    Decrement of instruction.
     */
    assemble_line(register, operation, address=0, tag=0, decrement=0) {
        if (isNaN(address) || isNaN(tag) || isNaN(decrement)) {
            throw NAN_EXCEPTION;
        }
        if (operation in operation_b_to_no) {
            this.general_memory[register].instruction_b = new Instruction_B(operation, address, tag);
        } else if (operation in operation_a_to_no) {
            this.general_memory[register].instruction_a = new Instruction_A(operation, address, tag, decrement);
        } else {
            throw UNDEFINED_OPERATION_EXCEPTION;
        }
    }

    /**
     * Returns the correct index register for the computer given a tag.
     *
     * @param {number} tag          The tag.
     * @returns {Index_Register}    The appropriate index register.
     */
    get_tag(tag) {
        let index_register;
        if (tag === 1) {
            index_register = this.index_a;
        } else if (tag === 2) {
            index_register = this.index_b;
        } else if (tag === 4) {
            index_register = this.index_c;
        }
        return index_register;
    }

    // Type B operations
    // Note: the this.storage_register should always be the same value as this.general_memory[address],
    // so the two are interchangeable.

    /**
     * Emulates the IBM 704 No Operation (NOP) operation.
     *
     * The calculator takes the next instruction in sequence (i.e. nothing happens).
     */
    NOP() {}

    /**
     * Emulates the IBM 704 Halt and Proceed (HPR) operation.
     *
     * Indicates the computer to halt.  If the computer is continued (on the original machine, pressing
     * the start key), the computer will begin executing from where it left off.
     *
     */
    HPR() {
        this.halt = true;
    }

    /**
     * Emulates the IBM 704 Store (STO) operation.
     *
     * Stores the value of the accumulator into the register with specified address.
     *
     * @param {number}  address     Address to store value to.
     */
    STO(address) {
        this.general_memory[address].fixed_point = this.accumulator.fixed_point; // ensures correct
        // copying of sign bit but not P or Q bits
    }

    /**
     * Emulates the IBM 704 Halt and Transfer (HTR) operation.
     *
     * Indicates the computer to halt.  If the computer is continued (on the original machine, pressing
     * the start key), the computer will begin executing from the indicated address.
     *
     * @param {number}  address     Address to resume running from.
     */
    HTR(address) {
        this.halt = true;
        this.ilc.update_contents(address);
    }

    /**
     * Emulates the IBM 704 Clear and Add (CLA) operation.
     *
     * Replaces the value of the accumulator with the value of the storage register (which should be
     * the value of the register with the indicated address).
     *
     */
    CLA() {
        this.accumulator.clear();
        this.accumulator.store_general_word(this.storage_register);
    }

    /**
     * Emulates the IBM 704 Add (ADD) operation.
     *
     * Adds the value of the storage register (which should be the value at address) to the
     * accumulator as if it were a fixed point number.
     *
     * @param {number}  address      The address of the value to add to the accumulator.
     */
    ADD(address) {
        this.accumulator.fixed_point += this.general_memory[address].fixed_point;
    }

    /**
     * Emulates the IMB 704 Subtract (SUB) operation.
     *
     * Subtracts the value of the storage register to the accumulator as if it were a
     * fixed point number.
     *
     * @param {number}  address     The address of the value to subtract from the accumulator
     */

    SUB(address) {
        this.accumulator.fixed_point = this.accumulator.fixed_point - this.general_memory[address].fixed_point;
    }

    /**
     * Emulates the IMB 704 Subtract Magnitude (SBM) operation.
     *
     * Subtracts the magnitude of the storage register from the accumulator as if it were a
     * fixed number point.
     *
     * @param {number}  address     The address of the value to add to the accumulator
     */
    SBM(address) {
        this.accumulator.fixed_point = this.accumulator.fixed_point - Math.abs(this.general_memory[address].fixed_point);
    }

    /**
     * Emulates the IBM 704 Add Magnitude (ADM) operation.
     *
     * Add the magnitude of the storage register from the accumulator as if it were a
     * fixed point number.
     *
     * @param {number}  address     The address of the value to add to the accumulator.
     */
    ADM(address) {
        this.accumulator.fixed_point = this.accumulator.fixed_point + Math.abs(this.general_memory[address].fixed_point);
    }

    /**
     * Emulates the IBM 704 Load Index from Address (LXA) operation.
     *
     * Stores the address of the word at the specified address
     *
     * @param {number}  address     Address of register to extract address from.
     * @param {number}  tag         Specifies the index register to be changed.
     */
    LXA(address, tag) {
        let index_register = this.get_tag(tag);
        let address_to_store = this.storage_register.address;
        index_register.update_contents(address_to_store);
    }

    /**
     * Emulates the IBM 704 Floating Add (FAD) operation.
     *
     * Adds the floating point value of word at specified address to the accumulator, and stores the result
     * in floating point in the accumulator and the MQ register so that the MQ register contains floating
     * point error.  This process involved a complex series of bit manipulations, so this implementation
     * which uses Javascript to get around all that might be off by a couple bits.
     *
     */
    FAD() {
        const sum = this.storage_register.floating_point + this.accumulator.floating_point;
        if (sum === 0) {
            this.accumulator.fixed_point = 0;
            this.mq_register.fixed_point = 0;
        } else {
            this.accumulator.floating_point = sum;
            // the point of this is to get the floating point inaccuracy.  Of course, JavaScript has its own floating point issues...
            if (this.accumulator.floating_point !== 0) {
                let remainder = sum - this.accumulator.floating_point;
                let exponent = Math.floor(Math.log2(Math.abs(sum))) + 1;
                let characteristic = exponent + 128 - 27;
                this.mq_register.store_floating_point(remainder, characteristic);
            } else {
                this.mq_register.store_floating_point(sum, 0);
            }
        }
    }

    /**
     * Emulates the IBM 704 Floating Subtract (FSB) operation.
     *
     * Same as floating add except that the negative of the targeted address is placed in the
     * storage register.
     *
     */
    FSB() {
        this.storage_register.floating_point = -this.storage_register.floating_point;
        this.FAD();
    }

    /**
     * Emulates the IBM 704 Load MQ (LDQ) operation.
     *
     * Stores the value of the storage register into the Multiplier-Quotient Register.
     *
     */
    LDQ() {
        this.mq_register.update_contents(this.storage_register);
    }

    /**
     * Emulates the IBM 704 Store MQ (STQ) operation.
     *
     * Stores the value of the Multiplier-Quotient Register into General Memory at the specified address.
     *
     * @param {number}  address     Address of word to be changed.
     */
    STQ(address) {
        this.general_memory[address].update_contents(this.mq_register);
    }

    /**
     * Emulates the IBM 704 Multiply (MPY) operation.
     *
     * Multiplies the fixed-point value of the storage register by the fixed-point value of the Multiplier-
     * Quotient Register.  The 35 most significant bits are stored in the Accumulator, and the 35 least
     * significant bits are placed in the Multiplier-Quotient Register.
     *
     */
    MPY() {
        const result = this.storage_register.fixed_point * this.mq_register.fixed_point;
        if (result > 0) {
            // JS's bitshift doesn't go more than 32 places
            this.accumulator.fixed_point = Math.floor(result / 2 ** 35); // jshint ignore:line
        } else {
            // due to how the IBM 704 represents negative numbers; with a sign bit rather than two's complement
            this.accumulator.fixed_point = Math.ceil(result / 2 ** 35); // jshint ignore:line
            // ignore because apparently exponentiation operator is not supported by jshint
        }
        this.mq_register.fixed_point = result;
    }

    /**
     * Emulates the IBM 704 Floating Multiply (FPY) operation.
     *
     * Multiplies the floating point value of word at specified address by the MQ register, and stores the result
     * in floating point in the accumulator and the MQ register so that the MQ register contains floating
     * point error.  This process involved a complex series of bit manipulations, so this implementation
     * which uses Javascript to get around all that might be off by a couple bits.  In addition, unlike
     * the original machine, this will normalize the product even if the multiplicands are not normalized.
     *
     */
    FMP() {
        const product = this.storage_register.floating_point * this.mq_register.floating_point;
        if (product === 0) {
            this.accumulator.fixed_point = 0;
            this.mq_register.fixed_point = 0;
        } else {
            this.accumulator.floating_point = product;
            if (this.accumulator.floating_point !== 0) {
                let remainder = product - this.accumulator.floating_point;
                let exponent = Math.floor(Math.log2(Math.abs(product))) + 1;
                let characteristic = exponent + 128 - 27;
                this.mq_register.store_floating_point(remainder, characteristic);
            } else {
                this.mq_register.store_floating_point(product, 0);
            }
        }
    }

    /**
     * The fixed-point division routine used by both DVH and DVP. The Accumulator and Multiplier-Quotient Register
     * are treated as a single 72-bit dividend to be divided by the Storage Register. The quotient is
     * stored in the Multiplier-Quotient Register, and the remainder is stored in the Accumulator, with
     * both having the same sign.
     *
     */
    fixed_point_divide() {
        let dividend = this.accumulator.fixed_point * (2 ** 35); // jshint ignore:line
            // ignore because apparently exponentiation operator is not supported by jshint
        if (dividend > 0 || Object.is(dividend, +0)) { // the sign of the MQ is ignored
            dividend += Math.abs(this.mq_register.fixed_point);
        } else {
            dividend -= Math.abs(this.mq_register.fixed_point);
        }
        const divisor = this.storage_register.fixed_point;

        const remainder = dividend % divisor;

        this.mq_register.fixed_point = (dividend - remainder)/divisor;
        this.accumulator.fixed_point = remainder;
    }

    /**
     * Emulates the IBM 704 Divide or Halt (DVH) operation.
     *
     * The Accumulator and Multiplier-Quotient Register are treated as a single 72-bit dividend to be divided by the
     * Storage Register. The quotient is stored in the Multiplier-Quotient Register, and the remainder is stored in the
     * Accumulator, with both having the same sign.
     *
     * If the Accumulator is greater than the Storage Register, then the quotient will not fit into the MQ
     * Register.  In this case, the computer will halt and turn on the Divide-Check Indicator Light.
     *
     */
    DVH() {
        if (Math.abs(this.storage_register.fixed_point) > Math.abs(this.accumulator.fixed_point)) {
            this.fixed_point_divide();
        } else {
            this.halt = true;
            this.divide_check = true;
        }
    }

    /**
     * Emulates the IBM 704 Divide or Proceed (DVP) operation.
     *
     * The Accumulator and Multiplier-Quotient Register are treated as a single 72-bit dividend to be divided by the
     * Storage Register. The quotient is stored in the Multiplier-Quotient Register, and the remainder is stored in the
     * Accumulator, with both having the same sign.
     *
     * If the Accumulator is greater than the Storage Register, then the quotient will not fit into the MQ
     * Register.  In this case, the computer will turn on the Divide-Check Indicator Light and proceed to
     * the next instruction.
     *
     */
    DVP() {
        if (Math.abs(this.storage_register.fixed_point) > Math.abs(this.accumulator.fixed_point)) {
            this.fixed_point_divide();
        } else {
            this.divide_check = true;
        }
    }

    /**
     * The floating-point division routine used by both FDH and FDP. The Accumulator is divided by the
     * Storage Register. The quotient is stored in the Multiplier-Quotient Register, and the remainder
     * is stored in the Accumulator.  May not imitate actual machine down to the bit.
     *
     */
    floating_divide() {
        const dividend = this.accumulator.floating_point;
        if (dividend === 0) {
            this.mq_register.fixed_point = dividend/Math.abs(dividend)*0; // for signed 0
            this.accumulator.fixed_point = dividend/Math.abs(dividend)*0;
            return;
        }
        const divisor = this.storage_register.floating_point;

        let ac_characteristic = parseInt(this.accumulator.contents.substring(1, 11), 2);
        const sr_characteristic = parseInt(this.storage_register.contents.substring(1, 9), 2);
        const ac_fraction = parseInt(this.accumulator.contents.substring(11, 38), 2);
        const sr_fraction = parseInt(this.storage_register.contents.substring(9, 36), 2);
        if (ac_fraction >= sr_fraction) {
            ac_characteristic += 1;
        }

        const result = dividend/divisor;

        this.mq_register.store_floating_point(result, ac_characteristic - sr_characteristic + 128);
        const remainder = dividend - this.mq_register.floating_point * divisor;
        this.accumulator.store_floating_point(remainder, ac_characteristic - 27);
    }

    /**
     * Emulates the IBM 704 Floating Divide or Halt (FDH) operation.
     *
     * The Accumulator is divided by the Storage Register. The quotient is stored in the Multiplier-Quotient
     * Register, and the remainder is stored in the Accumulator.  May not imitate actual machine down to the bit.
     * When division by zero is attempted or the magnitude of the fraction in the Accumulator is twice that
     * of the magnitude of the fraction in the Storage Register, the computer will halt and turn on the
     * Divide-Check Indicator light.
     *
     */
    FDH() {
        const ac_fraction = parseInt(this.accumulator.contents.substring(11, 38), 2);
        const sr_fraction = parseInt(this.storage_register.contents.substring(9, 36), 2);
        if (this.storage_register.floating_point === 0 || ac_fraction >= 2 * sr_fraction) {
            this.halt = true;
            this.divide_check = true;
        } else {
            this.floating_divide();
        }
    }

    /**
     * Emulates the IBM 704 Floating Divide or Proceed (FDP) operation.
     *
     * The Accumulator is divided by the Storage Register. The quotient is stored in the Multiplier-Quotient
     * Register, and the remainder is stored in the Accumulator.  May not imitate actual machine down to the bit.
     * When division by zero is attempted or the magnitude of the fraction in the Accumulator is twice that
     * of the magnitude of the fraction in the Storage Register, the computer will proceed to the next instruction
     * without dividing and turn on the Divide-Check Indicator light.
     *
     */
    FDP() {
        const ac_fraction = parseInt(this.accumulator.contents.substring(11, 38), 2);
        const sr_fraction = parseInt(this.storage_register.contents.substring(9, 36), 2);
        if (this.storage_register.floating_point === 0 || ac_fraction >= 2 * sr_fraction) {
            this.divide_check = true;
        } else {
            this.floating_divide();
        }
    }

    /**
     * Emulates the IBM 704 Transfer (TRA) operation.  Instruction Location Counter jumps to specified
     * address.
     *
     * @param {number}  address     Address to jump to.
     */
    TRA(address) {
        this.ilc.update_contents(address);
    }

    /**
     * Emulates the IBM 704 Transfer on Zero (TZE) operation.  If bits Q-35 of the accumulator are 0,
     * the Instruction Location Counter jumps to the specified address.  Otherwise, the program continues
     * to the next instruction.
     *
     * @param {number}  address     Address to jump to.
     */
    TZE(address) {
        if (this.accumulator.fixed_point === 0) {
            this.ilc.update_contents(address);
        }
    }

    /**
     * Emulates the IBM 704 Transfer on No Zero (TZE) operation.  If bits Q-35 of the accumulator are not all 0,
     * the Instruction Location Counter jumps to the specified address.  Otherwise, the program continues
     * to the next instruction.
     *
     * @param {number}  address     Address to jump to.
     */
    TNZ(address) {
        if (this.accumulator.fixed_point !== 0) {
            this.ilc.update_contents(address);
        }
    }

    /**
     * Emulates the IBM 704 Transfer on No Index (TNX) operation.
     *
     * If the number in the specified index register is equal to or less than the decrement, the number
     * in the index register is unchanged, the calculator takes the next instruction from specified address and
     * proceeds from there.  Not indexable.
     *
     * @param {number}  address     Address to jump to if index register is less than or equal to decrement.
     * @param {number}  tag         Specifies desired index register to decrement.
     * @param {number}  decrement   Amount to decrement by.
     */
    TNX(address, tag, decrement) {
        let index_register = this.get_tag(tag);
        if (index_register.valueOf() <= decrement) {
            this.ilc.update_contents(address);
        } else {
            index_register.update_contents(index_register.valueOf() - decrement);
        }
    }

    /**
     * Emulates the IBM 704 Transfer on Index (TIX) operation.
     *
     * If the number in the specified index register is greater than the decrement, the number in the
     * index register is reduced by the amount of the decrement and the calculator takes the next instruction
     * from specified address and proceeds from there.  Not indexable.
     *
     * @param {number}  address     Address to jump to if index register is greater than decrement.
     * @param {number}  tag         Specifies desired index register to decrement.
     * @param {number}  decrement   Amount to decrement by.
     */
    TIX(address, tag, decrement) {
        let index_register = this.get_tag(tag);
        if (index_register.valueOf() > decrement) {
            index_register.update_contents(index_register.valueOf() - decrement);
            this.ilc.update_contents(address);
        }
    }
}

/**
 * Class that represents a line of assembly code, but with added metadata for the GUI.
 */
export class Assembly_Line {

    /**
     * Constructor for class.  See demos.js for example.
     *
     * @param {string}             instruction              The text in the line.
     * @param {string}             description              Short description of line to be displayed at top of page.
     */
    constructor(instruction, description = undefined) {
        this.description = description;
        this.instruction = instruction;
    }

    /**
     * String representation that looks like this: 0: CLA 4
     * @returns {string}
     */
    toString() {
        return this.instruction;
    }
}

export function timer(ms) {
    return new Promise(res => setTimeout(res, ms));
}
