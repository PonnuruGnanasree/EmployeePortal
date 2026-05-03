const bcrypt = require('bcryptjs');
const hash = "$2b$10$BFHUpNTBom4qN8f74PEx3OLZ6qXWdm/CtMJTPr/wg8EFLp4t.2oNS";
const pwd = "Gnanasree@1504";
bcrypt.compare(pwd, hash).then(res => console.log('Match:', res));
