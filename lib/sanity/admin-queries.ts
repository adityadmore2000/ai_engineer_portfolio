export const adminProjectsQuery = `
  *[_type == "project"] | order(displayOrder asc, title asc) {
    _id,
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
