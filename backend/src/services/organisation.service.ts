import { organisationRepository } from "../repositories";

export interface OrganisationDTO {
  id: string;
  name: string;
  owner_user_id: string;
  created_at: string;
  updated_at: string;
  role: string;
}

const toDTO = (row: any): OrganisationDTO => ({
  id: row.id,
  name: row.name,
  owner_user_id: row.owner_user_id,
  created_at: new Date(row.created_at).toISOString(),
  updated_at: new Date(row.updated_at).toISOString(),
  role: row.membership_role,
});

export const getUserOrganisations = async (userId: string): Promise<OrganisationDTO[]> => {
  const organisations = await organisationRepository.findByUserId(userId);
  return organisations.map(toDTO);
};
