import { POLICIES } from "../data/policies.js";
import { getPolicyClients } from "../data/policyExtras.js";

export const getAllClients = (req, res) => {
    const rows = POLICIES.flatMap((policy)=>
        getPolicyClients(policy).map((client)=> ({policy, client }))
    );
    res.json({count: rows.length, rows });
};