const Joi = require('joi');

const statsSchema = Joi.object({
  username: Joi.string().trim().max(100).required(),
  level: Joi.number().integer().min(1).max(50).allow(null, ''),
  distanceWalked: Joi.number().min(0).allow(null, ''),
  caught: Joi.number().integer().min(0).allow(null, ''),
  stopVisited: Joi.number().integer().min(0).allow(null, ''),
  totalXp: Joi.number().integer().min(0).allow(null, ''),
  entryName: Joi.string().trim().max(100).allow(null, ''),
  createdAt: Joi.alternatives().try(Joi.date().iso(), Joi.string(), Joi.date()).allow(null, '')
});

const validateStats = (req, res, next) => {
  const { error } = statsSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
  if (error) {
    const messages = error.details.map(d => d.message).join(', ');
    console.error(`Validation error (Stats): ${messages}`);
    return res.status(400).json({ error: `Validation error: ${messages}` });
  }
  next();
};

const preferencesSchema = Joi.object({
  defaultUnit: Joi.string().valid('km', 'mi').allow(null, ''),
  showFunFacts: Joi.boolean().allow(null, ''),
  displayTutorial: Joi.boolean().allow(null, '')
});

const validatePreferences = (req, res, next) => {
  const { error } = preferencesSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
  if (error) {
    const messages = error.details.map(d => d.message).join(', ');
    console.error(`Validation error (Preferences): ${messages}`);
    return res.status(400).json({ error: `Validation error: ${messages}` });
  }
  next();
};

module.exports = {
  validateStats,
  validatePreferences
};
