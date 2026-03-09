// insights/contracts.js

/**
 * InsightInput
 * @typedef {Object} InsightInput
 * @property {string} site_id
 * @property {number} generated_at
 * @property {Object[]} labels
 * @property {string} labels[].label
 * @property {number} labels[].sessions
 * @property {number} labels[].share
 * @property {Object[]} labels[].representatives
 * @property {string} labels[].representatives[].session_id
 * @property {string} labels[].representatives[].anon_user_id
 * @property {Object} labels[].representatives[].summary
 * @property {Object[]} labels[].representatives[].evidence
 */

/**
 * InsightOutput
 * @typedef {Object} InsightOutput
 * @property {string} site_id
 * @property {number} generated_at
 * @property {Object[]} insights
 * @property {string} insights[].label
 * @property {string} insights[].where
 * @property {string[]} insights[].possible_causes
 * @property {string[]} insights[].validation_methods
 * @property {Object[]} insights[].recommended_experiments
 * @property {string} insights[].recommended_experiments[].hypothesis
 * @property {string} insights[].recommended_experiments[].change
 * @property {string} insights[].recommended_experiments[].primary_metric
 * @property {string} insights[].priority
 */

module.exports = {};
