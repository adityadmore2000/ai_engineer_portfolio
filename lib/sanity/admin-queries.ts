export const adminProjectsQuery = `
  *[_type == "project"] | order(displayOrder asc, title asc) {
    _id,
    _rev,
    title,
    "slug": slug.current,
    shortSummary,
    coverImage{ "url": asset->url, "alt": coalesce(alt, asset->altText) },
    technologies,
    displayOrder,
    published,
    sections[]{ _key, title, description }
  }
`;

export const adminProjectByIdQuery = `
  *[_type == "project" && _id == $id][0] {
    _id,
    _rev,
    title,
    "slug": slug.current,
    shortSummary,
    coverImage{ "url": asset->url, "alt": coalesce(alt, asset->altText), "assetRef": asset->_id },
    technologies,
    displayOrder,
    published,
    sections[]{ _key, title, description }
  }
`;

export const adminSiteSettingsQuery = `
  *[_type == "siteSettings"][0] {
    _id,
    _rev,
    email,
    role,
    shortBio,
    heroDescription,
    profileImage{ "url": asset->url, "alt": coalesce(alt, ""), "assetRef": asset->_id },
    linkedinUrl,
    githubUrl,
    aboutSummary
  }
`;

export const adminExperiencesQuery = `
  *[_type == "experience"] | order(coalesce(displayOrder, 999) asc, startDate desc) {
    _id,
    _rev,
    role,
    company,
    location,
    startDate,
    endDate,
    currentRole,
    shortDescription,
    bulletPoints,
    skills,
    displayOrder
  }
`;
