const Joi = require('@hapi/joi');
const {
  HOUSE,
  APARTMENT,
  COMMERCIAL,
} = require('../constants').BUILDING_TYPES;
const { substitutionValues } = require('../language/heplerFunctions');
const {
  floors,
  buildingType,
  buildingTypeMustBe,
  projectType,
  projectTypeMustBe,
  parkingRate,
  name,
  mustBeString,
  leastCharactersLong,
  lessEqualCharactersLong,
  required,
  description,
  address,
  mustBeNumber,
  mustGreaterOrEqual,
  mustLessOrEqual,
  notWhitespace,
} = require(`../language/${projectLang}/`).validators;

const schema = Joi.object({
  name: Joi.string()
    .trim()
    .min(2)
    .max(256)
    .required().messages({
      'string.base': substitutionValues(mustBeString, {item: name}),
      'string.trim': substitutionValues(notWhitespace, {item: name}),
      'string.min': substitutionValues(leastCharactersLong, {item: name, number: '2'}),
      'string.max': substitutionValues(lessEqualCharactersLong, {item: name, number: '256'}),
      'any.required': substitutionValues(required, {item: name}),
    }),

  description: Joi.string()
    .trim()
    .min(2)
    .max(5000)
    .required()
    .messages({
      'string.base': substitutionValues(mustBeString, {item: description}),
      'string.trim': substitutionValues(notWhitespace, {item: description}),
      'string.min': substitutionValues(leastCharactersLong, {item: description, number: '2'}),
      'string.max': substitutionValues(lessEqualCharactersLong, {item: description, number: '5000'}),
      'any.required': substitutionValues(required, {item: description}),
    }),

  address: Joi.string()
    .min(2)
    .max(256)
    .required()
    .messages({
      'string.base': substitutionValues(mustBeString, {item: address}),
      'string.min': substitutionValues(leastCharactersLong, {item: address, number: '2'}),
      'string.max': substitutionValues(lessEqualCharactersLong, {item: address, number: '256'}),
      'any.required': substitutionValues(required, {item: address}),
    }),

  floors: Joi.number()
    .min(0)
    .max(1000)
    .messages({
      'number.base': substitutionValues(mustBeNumber, {item: floors}),
      'number.min': substitutionValues(mustGreaterOrEqual, {item: floors, number: '0'}),
      'number.max': substitutionValues(mustLessOrEqual, {item: floors, number: '1000'}),
    }),

  isManual: Joi.boolean()
    .required(),

  buildingType: Joi.string()
    .valid(HOUSE, APARTMENT, COMMERCIAL)
    .required()
    .messages({
      'string.base': substitutionValues(mustBeString, {item: buildingType}),
      'any.only': buildingTypeMustBe,
      'any.required': substitutionValues(required, {item: buildingType}),
    }),

  projectType: Joi.string()
    .valid('new', 'renovation')
    .required()
    .messages({
      'string.base': substitutionValues(mustBeString, {item: projectType}),
      'any.only': projectTypeMustBe,
      'any.required': substitutionValues(required, {item: projectType}),
    }),

  elevator: Joi.boolean(),

  parkingProvided: Joi.boolean(),

  parkingRate: Joi.number().messages({
    'number.base': substitutionValues(mustBeNumber, {item: parkingRate})
  }),

  isAddressMatches: Joi.boolean().strict(),
  status: Joi.string().optional(),

});

module.exports = schema;
