import { register, get } from './registry'
import { baseRuleset } from './baseRuleset'
import { thermometerRuleset } from './thermometerRuleset'
import { cageRuleset } from './cageRuleset'

register(baseRuleset)
register(thermometerRuleset)
register(cageRuleset)

export const registry = { register, get }
