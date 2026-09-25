<?php

namespace App\Http\Requests;

use App\Models\Dealer;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateDealerRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        /** @var Dealer|int|string|null $dealer */
        $dealer = $this->route('dealer');
        $dealerId = $dealer instanceof Dealer ? $dealer->id : $dealer;

        return [
            'kode_dealer' => [
                'required',
                'string',
                'max:50',
                Rule::unique('dealers', 'kode_dealer')->ignore($dealerId),
            ],
            'nama_dealer' => ['required', 'string', 'max:255'],
            'link_google_maps' => ['nullable', 'string', 'max:2000'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'alamat' => ['nullable', 'string', 'max:1000'],
            'kelurahan' => ['nullable', 'string', 'max:100'],
            'kecamatan' => ['nullable', 'string', 'max:100'],
            'pos_code' => ['nullable', 'string', 'max:20'],
            'no_telp_showroom' => ['nullable', 'string', 'max:50'],
            'star_rate' => ['nullable', 'numeric', 'between:0,5'],
            'total_review' => ['nullable', 'integer', 'min:0'],
        ];
    }

    /**
     * Get custom attributes for validator errors.
     *
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'kode_dealer' => 'kode dealer',
            'nama_dealer' => 'nama dealer',
            'link_google_maps' => 'link google maps',
            'latitude' => 'latitude',
            'longitude' => 'longitude',
            'alamat' => 'alamat',
            'kelurahan' => 'kelurahan',
            'kecamatan' => 'kecamatan',
            'pos_code' => 'kode pos',
            'no_telp_showroom' => 'no telepon showroom',
            'star_rate' => 'star rate',
            'total_review' => 'total review',
        ];
    }
}
